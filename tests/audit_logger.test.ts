import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAuditLog,
  getAuditLogsForSession,
  subscribeToAuditStream,
  resetAuditStore
} from '../src/audit/auditLogger.js';
import { runAgentTurn, resetAgentSessions } from '../src/agent/agentLoop.js';
import { resetCartStore } from '../src/cart/cartManager.js';
import { resetOrderStore } from '../src/orders/orderManager.js';
import { resetGateStore } from '../src/agent/confirmationGate.js';
import { dispatchToolCall } from '../src/agent/toolDispatcher.js';

describe('Day 6 Checkpoint: Audit Logging & Real-Time Reasoning Trail', () => {
  beforeEach(() => {
    resetAuditStore();
    resetCartStore();
    resetOrderStore();
    resetAgentSessions();
    resetGateStore();
  });

  describe('1. Audit Record Creation & Field Integrity', () => {
    it('creates immutable log entries with timestamps, types, and outcomes', () => {
      const entry = recordAuditLog({
        sessionId: 'test_session_audit_1',
        turnIndex: 1,
        type: 'TOOL_EXECUTION',
        tool: 'search_catalog',
        args: { query: 'blazer' },
        outcome: 'SUCCESS',
        executionTimeMs: 12
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.tool).toBe('search_catalog');
      expect(entry.outcome).toBe('SUCCESS');
      expect(entry.executionTimeMs).toBe(12);
    });
  });

  describe('2. Real-Time Streaming Subscriber', () => {
    it('notifies subscribers immediately when an audit event is logged', () => {
      const capturedEvents: any[] = [];
      const unsubscribe = subscribeToAuditStream(event => {
        capturedEvents.push(event);
      });

      recordAuditLog({
        sessionId: 'test_session_stream',
        turnIndex: 1,
        type: 'AGENT_THOUGHT',
        thought: 'Analyzing user query for blue shirts',
        outcome: 'INFO'
      });

      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].thought).toContain('Analyzing user query');

      unsubscribe();

      recordAuditLog({
        sessionId: 'test_session_stream',
        turnIndex: 2,
        type: 'AGENT_THOUGHT',
        thought: 'Second thought after unsubscribe',
        outcome: 'INFO'
      });

      // Should not receive events after unsubscribe
      expect(capturedEvents.length).toBe(1);
    });
  });

  describe('3. End-to-End Conversation & Gate Rejection Logging', () => {
    const SESSION_ID = 'audit_conversation_session';

    it('logs every action in a conversation and logs blocked security rejections', async () => {
      // Step 1: Add items
      await runAgentTurn(SESSION_ID, 'add two of the blue Oxford shirt in size L');

      // Step 2: Adversarial attempt (direct payment without review)
      const blockedPay = await dispatchToolCall(SESSION_ID, 'initiate_payment', {});
      expect(blockedPay.isError).toBe(true);

      // Step 3: Legitimate Checkout & Confirmation
      await runAgentTurn(SESSION_ID, 'checkout');
      await runAgentTurn(SESSION_ID, 'yes confirm');

      // Verify Audit Trail
      const logs = getAuditLogsForSession(SESSION_ID);
      expect(logs.length).toBeGreaterThan(4);

      // Verify Tool Calls are logged
      const searchLogs = logs.filter(l => l.tool === 'search_catalog');
      const addLogs = logs.filter(l => l.tool === 'add_to_cart');
      expect(searchLogs.length).toBeGreaterThan(0);
      expect(addLogs.length).toBeGreaterThan(0);

      // Verify BLOCKED gate event is logged in audit trail
      const blockedGateLogs = logs.filter(l => l.type === 'GATE_EVALUATION' && l.outcome === 'BLOCKED');
      expect(blockedGateLogs.length).toBeGreaterThan(0);
      expect(blockedGateLogs[0].reason).toContain('GATE_LOCKED');

      // Verify SUCCESS payment event is logged
      const paymentLogs = logs.filter(l => l.type === 'PAYMENT_EVENT' && l.outcome === 'SUCCESS');
      expect(paymentLogs.length).toBe(1);
      expect(paymentLogs[0].result.orderId).toBeDefined();
    });
  });
});
