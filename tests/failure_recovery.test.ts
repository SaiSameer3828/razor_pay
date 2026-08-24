import { describe, it, expect, beforeEach } from 'vitest';
import { addToCart, getCartSummary, resetCartStore } from '../src/cart/cartManager.js';
import { handlePaymentDecline } from '../src/recovery/declineHandler.js';
import { interceptNearHallucination } from '../src/recovery/hallucinationGuard.js';
import { runAgentTurn, resetAgentSessions } from '../src/agent/agentLoop.js';
import { resetGateStore } from '../src/agent/confirmationGate.js';
import { resetAuditStore, getAuditLogsForSession } from '../src/audit/auditLogger.js';

describe('Day 8 Checkpoint: Failure Modes & Graceful Recovery', () => {
  beforeEach(() => {
    resetCartStore();
    resetGateStore();
    resetAgentSessions();
    resetAuditStore();
  });

  describe('1. Razorpay Payment Decline & Cart State Preservation', () => {
    const CART_ID = 'decline_test_cart';

    it('gracefully handles card declines without discarding the active cart', () => {
      // Step 1: User has 2 shirts in cart
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 2);
      const cartBefore = getCartSummary(CART_ID);
      expect(cartBefore.items.length).toBe(1);
      expect(cartBefore.totalQuantity).toBe(2);

      // Step 2: Razorpay Gateway emits a simulated decline
      const declineResult = handlePaymentDecline(
        'order_rzp_mock_123',
        'INSUFFICIENT_FUNDS',
        'The customer account has insufficient funds to cover the transaction amount.',
        cartBefore
      );

      // Step 3: Verify cart is preserved
      expect(declineResult.isRecovered).toBe(true);
      expect(declineResult.cartPreserved).toBe(true);
      expect(declineResult.cartSummary.items.length).toBe(1);
      expect(declineResult.cartSummary.pricing.totalInPaise).toBe(cartBefore.pricing.totalInPaise);

      // Step 4: Verify human-friendly explanation and retry options
      expect(declineResult.plainEnglishExplanation).toContain('Payment Did Not Go Through');
      expect(declineResult.plainEnglishExplanation).toContain('insufficient funds');
      expect(declineResult.retryOptions).toContain('Retry with UPI');

      // Step 5: Verify audit trail
      const logs = getAuditLogsForSession(CART_ID);
      const paymentLog = logs.find(l => l.type === 'PAYMENT_EVENT');
      expect(paymentLog?.outcome).toBe('FAILED');
    });
  });

  describe('2. Near-Hallucination Guardrail Interception', () => {
    const SESSION_ID = 'hallucination_session';

    it('intercepts queries for out-of-catalog items before false availability is claimed', () => {
      const result = interceptNearHallucination(SESSION_ID, 'Do you have leather jackets in size XL?');

      expect(result.isHallucination).toBe(true);
      expect(result.detectedUncataloguedEntity).toBe('leather jacket');
      expect(result.groundedCorrection).toContain("We currently don't carry **leather jackets**");
      expect(result.suggestedAlternatives?.length).toBeGreaterThan(0);
    });

    it('handles conversationally with grounded alternatives in ReAct loop', async () => {
      const reply = await runAgentTurn(SESSION_ID, 'show me Air Jordan sneakers');

      expect(reply.assistantReply).toContain("We currently don't carry **air jordans**");
      expect(reply.assistantReply).toContain('Classic Oxford Cotton Shirt');

      // Verify audit log captured interception
      const logs = getAuditLogsForSession(SESSION_ID);
      const interceptedLog = logs.find(l => l.thought?.includes('NEAR-HALLUCINATION INTERCEPTED'));
      expect(interceptedLog).toBeDefined();
    });
  });
});
