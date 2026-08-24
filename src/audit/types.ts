export type AuditEventType = 'AGENT_THOUGHT' | 'TOOL_EXECUTION' | 'GATE_EVALUATION' | 'PAYMENT_EVENT';
export type AuditOutcome = 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'INFO';

export interface AuditLogEntry {
  id: string;
  sessionId: string;
  turnIndex: number;
  timestamp: string;
  type: AuditEventType;
  thought?: string;
  tool?: string;
  args?: Record<string, any>;
  result?: any;
  outcome: AuditOutcome;
  reason?: string;
  stateBefore?: string;
  stateAfter?: string;
  executionTimeMs?: number;
}

export type AuditSubscriber = (entry: AuditLogEntry) => void;
