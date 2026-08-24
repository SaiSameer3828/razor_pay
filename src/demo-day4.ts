import { runAgentTurn } from './agent/agentLoop.js';

console.log('='.repeat(75));
console.log('🤖  DAY 4 CHECKPOINT DEMO: REACT AGENT LOOP & SAFE NON-MONEY TOOLS');
console.log('='.repeat(75));

const SESSION_ID = 'demo_react_user_sameer';

async function chat(prompt: string) {
  console.log(`\n👤 User: "${prompt}"`);
  const response = await runAgentTurn(SESSION_ID, prompt);

  console.log('🧠 ReAct Agent Trace:');
  response.thoughtProcess.forEach(step => {
    console.log(`   💭 Thought: ${step.thought}`);
    if (step.action) {
      console.log(`   ⚡ Action:  ${step.action.tool}(${JSON.stringify(step.action.args)})`);
    }
  });

  console.log(`🤖 Assistant Reply:\n${response.assistantReply}`);
  console.log(`🛒 Cart State: ${response.cartSummary.totalQuantity} items | Total: ₹${response.cartSummary.pricing.totalInRupees.toFixed(2)}`);
  console.log('-'.repeat(75));
}

// Turn 1: Add items using natural language
await chat('add two of the blue Oxford shirt in size L');

// Turn 2: Add complementary blazer
await chat('add 1 linen blazer in size 40');

// Turn 3: Ask to inspect cart
await chat('what is in my cart?');

// Turn 4: Apply discount code
await chat('apply coupon WELCOME10');

// Turn 5: Remove an item
await chat('remove the Oxford shirt');

console.log('\n' + '='.repeat(75));
console.log('✅ DAY 4 CHECKPOINT COMPLETE: Natural Language ReAct Loop Working');
console.log('='.repeat(75));
