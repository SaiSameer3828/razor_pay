import { CartSummary } from '../cart/types.js';
import { recordAuditLog } from '../audit/auditLogger.js';

export type ConfirmationState = 'SHOPPING' | 'REVIEWING_ORDER' | 'CONFIRMED_READY_FOR_PAYMENT' | 'PAYMENT_PROCESSED';

export interface SessionGateContext {
  sessionId: string;
  state: ConfirmationState;
  reviewedCartTotalInPaise?: number;
  reviewedAt?: string;
  confirmedAt?: string;
}

const gateStore = new Map<string, SessionGateContext>();

export function getSessionGate(sessionId: string): SessionGateContext {
  let gate = gateStore.get(sessionId);
  if (!gate) {
    gate = {
      sessionId,
      state: 'SHOPPING'
    };
    gateStore.set(sessionId, gate);
  }
  return gate;
}

/**
 * Transitions session to REVIEWING_ORDER state when an explicit summary is presented
 */
export function markOrderPresentedForReview(sessionId: string, currentCart: CartSummary): void {
  const gate = getSessionGate(sessionId);
  const stateBefore = gate.state;
  gate.state = 'REVIEWING_ORDER';
  gate.reviewedCartTotalInPaise = currentCart.pricing.totalInPaise;
  gate.reviewedAt = new Date().toISOString();
  gate.confirmedAt = undefined;
  gateStore.set(sessionId, gate);

  recordAuditLog({
    sessionId,
    turnIndex: 0,
    type: 'GATE_EVALUATION',
    thought: `Order summary presented for review. Total locked at ₹${(currentCart.pricing.totalInPaise / 100).toFixed(2)} (${currentCart.pricing.totalInPaise} paise). Awaiting human confirmation.`,
    outcome: 'INFO',
    stateBefore,
    stateAfter: 'REVIEWING_ORDER'
  });
}

/**
 * Marks explicit human confirmation
 */
export function recordExplicitHumanConfirmation(sessionId: string): void {
  const gate = getSessionGate(sessionId);
  const stateBefore = gate.state;
  if (gate.state === 'REVIEWING_ORDER') {
    gate.state = 'CONFIRMED_READY_FOR_PAYMENT';
    gate.confirmedAt = new Date().toISOString();
    gateStore.set(sessionId, gate);

    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: 'Human user provided explicit positive confirmation. Gate unlocked for Razorpay payment initiation.',
      outcome: 'SUCCESS',
      stateBefore,
      stateAfter: 'CONFIRMED_READY_FOR_PAYMENT'
    });
  }
}

/**
 * Invalidates confirmation if cart is modified after review
 */
export function invalidateConfirmationOnCartChange(sessionId: string): void {
  const gate = getSessionGate(sessionId);
  if (gate.state !== 'SHOPPING') {
    const stateBefore = gate.state;
    gate.state = 'SHOPPING';
    gate.reviewedCartTotalInPaise = undefined;
    gate.reviewedAt = undefined;
    gate.confirmedAt = undefined;
    gateStore.set(sessionId, gate);

    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: 'Cart was modified after order review. Confirmation invalidated to prevent price drift. New review required.',
      outcome: 'INFO',
      stateBefore,
      stateAfter: 'SHOPPING'
    });
  }
}

/**
 * HARD CODE GATE: Verifies that payment initiation is strictly authorized.
 * This is executed in runtime backend code, completely immune to LLM prompt injection.
 */
export function evaluatePaymentGate(
  sessionId: string,
  currentCart: CartSummary
): { allowed: boolean; reason?: string; snapshottedTotalInPaise?: number } {
  const gate = getSessionGate(sessionId);

  // Guard 1: Cart cannot be empty
  if (currentCart.items.length === 0) {
    const reason = 'BLOCKED: Cart is empty.';
    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: 'Blocked payment initiation: Cart is empty.',
      outcome: 'BLOCKED',
      reason,
      stateBefore: gate.state,
      stateAfter: gate.state
    });
    return { allowed: false, reason };
  }

  // Guard 2: Cart must be in stock
  if (!currentCart.isReadyForCheckout) {
    const reason = `BLOCKED: Cart is not ready for checkout. ${currentCart.validationWarnings.join(' ')}`;
    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: `Blocked payment initiation: Cart has inventory/stock warnings: ${currentCart.validationWarnings.join(', ')}`,
      outcome: 'BLOCKED',
      reason,
      stateBefore: gate.state,
      stateAfter: gate.state
    });
    return { allowed: false, reason };
  }

  // Guard 3: Must be in confirmed state
  if (gate.state !== 'CONFIRMED_READY_FOR_PAYMENT') {
    let reason = 'GATE_LOCKED: Payment cannot be initiated directly. An explicit order review summary must be presented and confirmed by the user first.';
    if (gate.state === 'REVIEWING_ORDER') {
      reason = 'GATE_LOCKED: Awaiting explicit user confirmation. The user has not confirmed the presented order summary.';
    } else if (gate.state === 'PAYMENT_PROCESSED') {
      reason = 'GATE_LOCKED: Payment for this reviewed order was already processed.';
    }

    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: `Security Gate BLOCKED unconfirmed payment attempt. Current state: "${gate.state}". Required state: "CONFIRMED_READY_FOR_PAYMENT".`,
      outcome: 'BLOCKED',
      reason,
      stateBefore: gate.state,
      stateAfter: gate.state
    });

    return { allowed: false, reason };
  }

  // Guard 4: Total Price Tampering Check (Cart total must match reviewed total)
  if (gate.reviewedCartTotalInPaise !== currentCart.pricing.totalInPaise) {
    invalidateConfirmationOnCartChange(sessionId);
    const reason = 'GATE_LOCKED: Cart contents or pricing changed after review. A new confirmation is required.';

    recordAuditLog({
      sessionId,
      turnIndex: 0,
      type: 'GATE_EVALUATION',
      thought: `Security Gate BLOCKED payment: Price drift detected! Reviewed total was ${gate.reviewedCartTotalInPaise} paise, but current total is ${currentCart.pricing.totalInPaise} paise.`,
      outcome: 'BLOCKED',
      reason,
      stateBefore: 'CONFIRMED_READY_FOR_PAYMENT',
      stateAfter: 'SHOPPING'
    });

    return { allowed: false, reason };
  }

  // Guard 5: Time window check (confirmation valid for max 10 minutes)
  if (gate.confirmedAt) {
    const elapsedMs = Date.now() - new Date(gate.confirmedAt).getTime();
    if (elapsedMs > 10 * 60 * 1000) {
      invalidateConfirmationOnCartChange(sessionId);
      const reason = 'GATE_LOCKED: User confirmation has expired (10-minute timeout). Please re-confirm.';

      recordAuditLog({
        sessionId,
        turnIndex: 0,
        type: 'GATE_EVALUATION',
        thought: 'Security Gate BLOCKED payment: Confirmation expired (> 10 minutes).',
        outcome: 'BLOCKED',
        reason,
        stateBefore: 'CONFIRMED_READY_FOR_PAYMENT',
        stateAfter: 'SHOPPING'
      });

      return { allowed: false, reason };
    }
  }

  // Gate Passed: Return the verified snapshot total
  return {
    allowed: true,
    snapshottedTotalInPaise: gate.reviewedCartTotalInPaise
  };
}

export function resetGateStore(): void {
  gateStore.clear();
}
