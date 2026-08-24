import { runAgentTurn } from './agent/agentLoop.js';
import { dispatchToolCall } from './agent/toolDispatcher.js';
import { getAuditLogsForSession } from './audit/auditLogger.js';

console.log('='.repeat(80));
console.log('🧠  DAY 6 CHECKPOINT DEMO: AUDIT LOGGING & LIVE REASONING TRAIL');
console.log('='.repeat(80));

const SESSION_ID = 'demo_audit_session_sameer';

console.log('\n💬 1. User says: "add two blue shirts in size L"');
await runAgentTurn(SESSION_ID, 'add two blue shirts in size L');

console.log('\n🚨 2. Simulated Adversarial Attack: Attempting unreviewed direct payment:');
await dispatchToolCall(SESSION_ID, 'initiate_payment', {});

console.log('\n💬 3. User says: "I want to checkout"');
await runAgentTurn(SESSION_ID, 'I want to checkout');

console.log('\n💬 4. User says: "yes confirm"');
await runAgentTurn(SESSION_ID, 'yes confirm');

console.log('\n' + '='.repeat(80));
console.log('📋 AUDIT TRAIL LOG RECORDED IN POSTGRES/DATABASE LEDGER:');
console.log('='.repeat(80));

const logs = getAuditLogsForSession(SESSION_ID);
logs.forEach((entry, idx) => {
  const time = entry.timestamp.split('T')[1].slice(0, 8);
  console.log(`[#${idx + 1}] [${time}] [${entry.type}] Outcome: ${entry.outcome}`);
  if (entry.thought) console.log(`    💭 Thought: ${entry.thought}`);
  if (entry.tool) console.log(`    ⚡ Tool:    ${entry.tool} (${entry.executionTimeMs || 0}ms)`);
  if (entry.reason) console.log(`    ⚠️  Reason:  ${entry.reason}`);
  if (entry.stateBefore && entry.stateAfter) console.log(`    🔄 State:   ${entry.stateBefore} -> ${entry.stateAfter}`);
  console.log('-'.repeat(80));
});

console.log(`\n✅ Total Audit Entries: ${logs.length}`);
console.log('='.repeat(80));
console.log('✅ DAY 6 CHECKPOINT COMPLETE: Live Streaming & Immutable Audit Trail Working');
console.log('='.repeat(80));
