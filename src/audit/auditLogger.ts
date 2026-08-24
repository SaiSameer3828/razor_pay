import { AuditLogEntry, AuditSubscriber } from './types.js';

// In-Memory immutable audit trail (Postgres table 'agent_audit_logs' compatible)
const auditLogsStore: AuditLogEntry[] = [];
const subscribers = new Set<AuditSubscriber>();

/**
 * Records a new immutable audit entry and broadcasts to live streaming subscribers
 */
export function recordAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  auditLogsStore.push(fullEntry);

  // Broadcast to all active SSE subscribers in real time
  for (const subscriber of subscribers) {
    try {
      subscriber(fullEntry);
    } catch (err) {
      console.error('Error notifying audit log subscriber:', err);
    }
  }

  return fullEntry;
}

/**
 * Retrieves chronological audit trail for a specific session
 */
export function getAuditLogsForSession(sessionId: string): AuditLogEntry[] {
  return auditLogsStore.filter(entry => entry.sessionId === sessionId);
}

/**
 * Retrieves all audit logs
 */
export function getAllAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLogsStore.slice(-limit);
}

/**
 * Subscribes to live audit log stream (used by Server-Sent Events endpoint)
 */
export function subscribeToAuditStream(subscriber: AuditSubscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function resetAuditStore(): void {
  auditLogsStore.length = 0;
}
