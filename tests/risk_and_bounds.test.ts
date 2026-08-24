import { describe, it, expect, beforeEach } from 'vitest';
import { addToCart, getCartSummary, resetCartStore } from '../src/cart/cartManager.js';
import { evaluateCartRisk } from '../src/security/riskEngine.js';
import { runAgentTurn, resetAgentSessions } from '../src/agent/agentLoop.js';
import { resetGateStore } from '../src/agent/confirmationGate.js';
import { resetAuditStore, getAuditLogsForSession } from '../src/audit/auditLogger.js';

describe('Day 7 Checkpoint: Bounds, Limits & Dynamic Risk Scoring', () => {
  beforeEach(() => {
    resetCartStore();
    resetGateStore();
    resetAgentSessions();
    resetAuditStore();
  });

  describe('1. Hard Inventory & Order Quantity Boundaries', () => {
    const CART_ID = 'bounds_test_cart';

    it('strictly enforces MAX_QUANTITY_PER_SKU = 5 bound', () => {
      // Adding 5 units is allowed
      const allowedRes = addToCart(CART_ID, 'prod_heavyweight_tee', 'var_tee_blk_m', 5);
      expect(allowedRes.success).toBe(true);

      // Attempting to add 1 more exceeds limit of 5
      const excessRes = addToCart(CART_ID, 'prod_heavyweight_tee', 'var_tee_blk_m', 1);
      expect(excessRes.success).toBe(false);
      expect(excessRes.error).toBe('EXCEEDS_MAX_QUANTITY_PER_SKU');
      expect(excessRes.message).toContain('limit is 5 units per item');
    });
  });

  describe('2. Dynamic Risk Scoring Engine', () => {
    const CART_ID = 'risk_score_cart';

    it('classifies normal affordable carts as LOW risk', () => {
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1); // ₹1,899
      const summary = getCartSummary(CART_ID);

      const risk = evaluateCartRisk(summary);
      expect(risk.riskLevel).toBe('LOW');
      expect(risk.riskScore).toBeLessThan(25);
      expect(risk.requiresElevatedConfirmation).toBe(false);
      expect(risk.isBlocked).toBe(false);
    });

    it('classifies high-value carts (>₹20,000) as ELEVATED risk tier', () => {
      // 3x Chronograph Watch = 3 * ₹6,999 = ₹20,997
      addToCart(CART_ID, 'prod_chronograph_watch', 'var_wtc_slv_onesize', 3);
      const summary = getCartSummary(CART_ID);

      const risk = evaluateCartRisk(summary);
      expect(risk.riskLevel).toBe('ELEVATED');
      expect(risk.riskScore).toBeGreaterThanOrEqual(25);
      expect(risk.requiresElevatedConfirmation).toBe(true);
      expect(risk.factors).toContain('ELEVATED_ORDER_VALUE (>₹20,000)');
    });

    it('strictly BLOCKS orders exceeding ₹50,000 safety ceiling', () => {
      // 5x Chronograph Watch = 5 * ₹7,499 = ₹37,495 + 4x Linen Blazer (4 * 5,499 = ₹21,996) = ~₹60,000
      addToCart(CART_ID, 'prod_chronograph_watch', 'var_wtc_blk_onesize', 5);
      addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 4);
      const summary = getCartSummary(CART_ID);

      const risk = evaluateCartRisk(summary);
      expect(risk.riskLevel).toBe('CRITICAL_BLOCKED');
      expect(risk.isBlocked).toBe(true);
      expect(risk.blockedReason).toContain('exceeds the conversational safety ceiling');
    });
  });

  describe('3. Conversational Agent Risk Handling & Bounding Refusal', () => {
    const SESSION_ID = 'agent_risk_session';

    it('attaches elevated risk advisory to order review for high value purchases', async () => {
      await runAgentTurn(SESSION_ID, 'add 3 watches');
      const reviewTurn = await runAgentTurn(SESSION_ID, 'checkout');

      expect(reviewTurn.assistantReply).toContain('High-Value Order Advisory');
      expect(reviewTurn.assistantReply).toContain('Risk Tier: ELEVATED');
    });

    it('explains ceiling violation when an absurd order is attempted', async () => {
      // Build a >₹50,000 cart
      addToCart(SESSION_ID, 'prod_chronograph_watch', 'var_wtc_blk_onesize', 5);
      addToCart(SESSION_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 4);

      const checkoutTurn = await runAgentTurn(SESSION_ID, 'checkout');
      expect(checkoutTurn.assistantReply).toContain('Order Safety Limit Reached');
      expect(checkoutTurn.assistantReply).toContain('exceeds the conversational safety ceiling of ₹50,000');
    });
  });
});
