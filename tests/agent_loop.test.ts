import { describe, it, expect, beforeEach } from 'vitest';
import { SAFE_TOOLS } from '../src/agent/tools.js';
import { dispatchToolCall } from '../src/agent/toolDispatcher.js';
import { runAgentTurn, resetAgentSessions } from '../src/agent/agentLoop.js';
import { resetCartStore } from '../src/cart/cartManager.js';

describe('Day 4 Checkpoint: Tool Schema & ReAct Agent Loop Skeleton', () => {
  beforeEach(() => {
    resetCartStore();
    resetAgentSessions();
  });

  describe('1. Tool Definitions & JSON Schema Integrity', () => {
    it('defines only safe, non-monetary tools', () => {
      const toolNames = SAFE_TOOLS.map(t => t.name);
      expect(toolNames).toContain('search_catalog');
      expect(toolNames).toContain('get_product_details');
      expect(toolNames).toContain('add_to_cart');
      expect(toolNames).toContain('update_cart_quantity');
      expect(toolNames).toContain('remove_from_cart');
      expect(toolNames).toContain('get_cart_summary');
      expect(toolNames).toContain('apply_coupon');

      // Crucial Safety: NO payment or money-moving tool is exposed on Day 4
      expect(toolNames).not.toContain('initiate_payment');
      expect(toolNames).not.toContain('charge_card');
    });

    it('each tool has valid parameters object and descriptions', () => {
      for (const tool of SAFE_TOOLS) {
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.parameters.type).toBe('object');
        expect(typeof tool.parameters.properties).toBe('object');
      }
    });
  });

  describe('2. Tool Dispatcher Execution', () => {
    const TEST_CART = 'dispatcher_cart_test';

    it('dispatches search_catalog tool and returns formatted items', () => {
      const result = dispatchToolCall(TEST_CART, 'search_catalog', { query: 'blazer' });
      expect(result.isError).toBeFalsy();
      expect(result.result.count).toBeGreaterThan(0);
      expect(result.result.products[0].name).toContain('Blazer');
    });

    it('dispatches add_to_cart tool and modifies cart state', () => {
      const result = dispatchToolCall(TEST_CART, 'add_to_cart', {
        product_id: 'prod_oxford_shirt',
        variant_id: 'var_ox_blu_l',
        quantity: 2
      });

      expect(result.isError).toBeFalsy();
      expect(result.result.success).toBe(true);
      expect(result.result.cart.totalQuantity).toBe(2);
    });

    it('rejects unknown tool calls gracefully', () => {
      const result = dispatchToolCall(TEST_CART, 'unauthorized_hack_tool', {});
      expect(result.isError).toBe(true);
      expect(result.result.error).toContain('not recognized');
    });
  });

  describe('3. ReAct Conversational Loop (Natural Language -> Tool -> State Update)', () => {
    const SESSION_ID = 'test_agent_react_user';

    it('handles natural dialogue "add two of the blue one" and updates cart correctly', async () => {
      const response = await runAgentTurn(SESSION_ID, 'add two of the blue shirt in size L');

      // 1. Verify Thought Process trace
      expect(response.thoughtProcess.length).toBeGreaterThanOrEqual(2);
      expect(response.thoughtProcess[0].thought).toBeDefined();
      expect(response.thoughtProcess[0].action?.tool).toBe('search_catalog');
      expect(response.thoughtProcess[1].action?.tool).toBe('add_to_cart');

      // 2. Verify Assistant Reply
      expect(response.assistantReply).toContain('Added');
      expect(response.assistantReply).toContain('Classic Oxford Cotton Shirt');

      // 3. Verify Cart State
      expect(response.cartSummary.totalQuantity).toBe(2);
      expect(response.cartSummary.items[0].size).toBe('L');
      expect(response.cartSummary.items[0].color).toBe('Royal Oxford Blue');
    });

    it('handles asking to show cart summary', async () => {
      // First add an item
      await runAgentTurn(SESSION_ID, 'add 1 linen blazer in size 40');

      // Then ask to show cart
      const response = await runAgentTurn(SESSION_ID, 'show what is in my cart');

      expect(response.thoughtProcess.some(t => t.action?.tool === 'get_cart_summary')).toBe(true);
      expect(response.assistantReply).toContain('cart summary');
      expect(response.assistantReply).toContain('Italian Tailored Linen Blazer');
      expect(response.cartSummary.totalQuantity).toBe(1);
    });

    it('handles removing items by natural language request', async () => {
      await runAgentTurn(SESSION_ID, 'add 1 silk tie');
      expect((await runAgentTurn(SESSION_ID, 'view cart')).cartSummary.totalQuantity).toBe(1);

      const removeResponse = await runAgentTurn(SESSION_ID, 'remove the silk tie');
      expect(removeResponse.thoughtProcess.some(t => t.action?.tool === 'remove_from_cart')).toBe(true);
      expect(removeResponse.cartSummary.totalQuantity).toBe(0);
    });

    it('handles coupon application via conversation', async () => {
      await runAgentTurn(SESSION_ID, 'add 1 linen blazer');
      const couponResponse = await runAgentTurn(SESSION_ID, 'apply discount WELCOME10');

      expect(couponResponse.thoughtProcess.some(t => t.action?.tool === 'apply_coupon')).toBe(true);
      expect(couponResponse.cartSummary.pricing.discountInRupees).toBe(500);
      expect(couponResponse.assistantReply).toContain('WELCOME10');
    });
  });
});
