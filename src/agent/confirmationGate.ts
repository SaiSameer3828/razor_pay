import { CartSummary } from '../cart/types.js';

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
  gate.state = 'REVIEWING_ORDER';
  gate.reviewedCartTotalInPaise = currentCart.pricing.totalInPaise;
  gate.reviewedAt = new Date().toISOString();
  gate.confirmedAt = undefined;
  gateStore.set(sessionId, gate);
}

/**
 * Marks explicit human confirmation
 */
export function recordExplicitHumanConfirmation(sessionId: string): void {
  const gate = getSessionGate(sessionId);
  if (gate.state === 'REVIEWING_ORDER') {
    gate.state = 'CONFIRMED_READY_FOR_PAYMENT';
    gate.confirmedAt = new Date().toISOString();
    gateStore.set(sessionId, gate);
  }
}

/**
 * Invalidates confirmation if cart is modified after review
 */
export function invalidateConfirmationOnCartChange(sessionId: string): void {
  const gate = getSessionGate(sessionId);
  gate.state = 'SHOPPING';
  gate.reviewedCartTotalInPaise = undefined;
  gate.reviewedAt = undefined;
  gate.confirmedAt = undefined;
  gateStore.set(sessionId, gate);
}

/**
 * HARD CODE GATE: Verifies that payment initiation is strictly authorized.
 * This is executed in runtime backend code, completely immune to LLM prompt injection.
 */
export function evaluatePaymentGate(
  sessionId: string,
  currentCart: CartSummary
): { allowed: boolean; reason?: string } {
  const gate = getSessionGate(sessionId);

  // Guard 1: Cart cannot be empty
  if (currentCart.items.length === 0) {
    return { allowed: false, reason: 'BLOCKED: Cart is empty.' };
  }

  // Guard 2: Cart must be in stock
  if (!currentCart.isReadyForCheckout) {
    return { allowed: false, reason: `BLOCKED: Cart is not ready for checkout. ${currentCart.validationWarnings.join(' ')}` };
  }

  // Guard 3: Must be in confirmed state
  if (gate.state !== 'CONFIRMED_READY_FOR_PAYMENT') {
    if (gate.state === 'SHOPPING') {
      return {
        allowed: false,
        reason: 'GATE_LOCKED: Payment cannot be initiated directly. An explicit order review summary must be presented and confirmed by the user first.'
      };
    }
    if (gate.state === 'REVIEWING_ORDER') {
      return {
        allowed: false,
        reason: 'GATE_LOCKED: Awaiting explicit user confirmation. The user has not confirmed the presented order summary.'
      };
    }
    if (gate.state === 'PAYMENT_PROCESSED') {
      return {
        allowed: false,
        reason: 'GATE_LOCKED: Payment for this reviewed order was already processed.'
      };
    }
  }

  // Guard 4: Total Price Tampering Check (Cart total must match reviewed total)
  if (gate.reviewedCartTotalInPaise !== currentCart.pricing.totalInPaise) {
    invalidateConfirmationOnCartChange(sessionId);
    return {
      allowed: false,
      reason: 'GATE_LOCKED: Cart contents or pricing changed after review. A new confirmation is required.'
    };
  }

  // Guard 5: Time window check (confirmation valid for max 10 minutes)
  if (gate.confirmedAt) {
    const elapsedMs = Date.now() - new Date(gate.confirmedAt).getTime();
    if (elapsedMs > 10 * 60 * 1000) {
      invalidateConfirmationOnCartChange(sessionId);
      return {
        allowed: false,
        reason: 'GATE_LOCKED: User confirmation has expired (10-minute timeout). Please re-confirm.'
      };
    }
  }

  return { allowed: true };
}

export function resetGateStore(): void {
  gateStore.clear();
}
