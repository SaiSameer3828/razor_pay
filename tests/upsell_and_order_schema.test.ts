import { describe, it, expect, beforeEach } from 'vitest';
import { addToCart, getCartSummary, resetCartStore } from '../src/cart/cartManager.js';
import { getUpsellRecommendation } from '../src/recommendations/upsellEngine.js';
import { createOrderFromCart, resetOrderStore } from '../src/orders/orderManager.js';
import { buildStructuredOrderObject } from '../src/orders/structuredOrder.js';
import { runAgentTurn, resetAgentSessions } from '../src/agent/agentLoop.js';
import { resetGateStore } from '../src/agent/confirmationGate.js';
import { resetAuditStore } from '../src/audit/auditLogger.js';

describe('Day 9 Checkpoint: Contextual Upsell & Structured Order Object Schema', () => {
  beforeEach(() => {
    resetCartStore();
    resetOrderStore();
    resetGateStore();
    resetAgentSessions();
    resetAuditStore();
  });

  describe('1. Contextual Upsell & Cross-Sell Engine', () => {
    const CART_ID = 'upsell_test_cart';

    it('generates a matching Silk Tie upsell when Oxford Shirt is in cart', () => {
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
      const summary = getCartSummary(CART_ID);

      const upsell = getUpsellRecommendation(summary);
      expect(upsell.eligible).toBe(true);
      expect(upsell.recommendedProduct?.id).toBe('prod_silk_tie');
      expect(upsell.additionalPriceInRupees).toBe(899);
      expect(upsell.pitchMessage).toContain('Mulberry Silk Necktie');
    });

    it('does NOT recommend the upsell if the user already has that item in cart', () => {
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
      const summary = getCartSummary(CART_ID);

      const upsell = getUpsellRecommendation(summary);
      expect(upsell.eligible).toBe(false);
    });
  });

  describe('2. Conversational Upsell Flow & Financial Recalculation', () => {
    const SESSION_ID = 'upsell_conversation_session';

    it('fires natural upsell pitch and updates cart total upon conversational acceptance', async () => {
      // Step 1: User adds shirt -> Assistant replies with shirt + upsell pitch
      const turn1 = await runAgentTurn(SESSION_ID, 'add two blue shirts in size L');
      expect(turn1.assistantReply).toContain('Style Recommendation');
      expect(turn1.assistantReply).toContain('Mulberry Silk Necktie');

      const cartAfterTurn1 = getCartSummary(SESSION_ID);
      expect(cartAfterTurn1.totalQuantity).toBe(2);
      const initialTotal = cartAfterTurn1.pricing.totalInRupees;

      // Step 2: User accepts upsell
      const turn2 = await runAgentTurn(SESSION_ID, 'yes add the tie');
      expect(turn2.assistantReply).toContain('Added **Pure Mulberry Silk Necktie**');

      // Step 3: Verify cart updated and financials recalculated with tie
      const cartAfterTurn2 = getCartSummary(SESSION_ID);
      expect(cartAfterTurn2.totalQuantity).toBe(3); // 2 shirts + 1 tie
      expect(cartAfterTurn2.items.length).toBe(2);
      expect(cartAfterTurn2.pricing.totalInRupees).toBeGreaterThan(initialTotal);
    });
  });

  describe('3. Structured Agent-Consumable Order Payload Schema', () => {
    const CART_ID = 'structured_order_cart';

    it('produces a rich, agent-consumable structured order object', async () => {
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);

      const checkoutRes = await createOrderFromCart(CART_ID, {
        customerDetails: {
          name: 'Sai Sameer',
          email: 'sameer@example.com',
          phone: '9876543210'
        }
      });

      expect(checkoutRes.success).toBe(true);

      const structured = buildStructuredOrderObject(
        checkoutRes.order!,
        checkoutRes.razorpayOrder!
      );

      expect(structured.schemaVersion).toBe('2026-08-24.v1');
      expect(structured.orderId).toBe(checkoutRes.order!.id);
      expect(structured.customer.name).toBe('Sai Sameer');
      expect(structured.lineItems.length).toBe(2);
      expect(structured.financials.currency).toBe('INR');
      expect(structured.financials.totalPayableInRupees).toBe(checkoutRes.order!.totalInPaise / 100);
      expect(structured.paymentGateway.provider).toBe('Razorpay');
      expect(structured.paymentGateway.razorpayOrderId).toBe(checkoutRes.razorpayOrder!.id);
      expect(structured.securityAudit.confirmationState).toBe('CONFIRMED_READY_FOR_PAYMENT');
      expect(structured.nextActions.length).toBeGreaterThan(0);
    });
  });
});
