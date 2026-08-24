import { runAgentTurn } from './agent/agentLoop.js';
import { createOrderFromCart } from './orders/orderManager.js';
import { buildStructuredOrderObject } from './orders/structuredOrder.js';

console.log('='.repeat(80));
console.log('🛍️  DAY 9 CHECKPOINT DEMO: CONTEXTUAL UPSELL & STRUCTURED ORDER OBJECT');
console.log('='.repeat(80));

const SESSION_ID = 'demo_day9_upsell_session';

// Step 1: User adds an item
console.log('\n💬 1. User says: "add two blue shirts in size L"');
const turn1 = await runAgentTurn(SESSION_ID, 'add two blue shirts in size L');
console.log(`🤖 Assistant:\n${turn1.assistantReply}`);

// Step 2: User accepts upsell recommendation
console.log('\n' + '-'.repeat(80));
console.log('💬 2. User accepts upsell: "yes add the tie"');
const turn2 = await runAgentTurn(SESSION_ID, 'yes add the tie');
console.log(`🤖 Assistant:\n${turn2.assistantReply}`);

// Step 3: Checkout and generate Structured Order Object
console.log('\n' + '-'.repeat(80));
console.log('📦 3. Generating Structured Agent-Consumable Order Object:');
const checkoutRes = await createOrderFromCart(SESSION_ID, {
  customerDetails: {
    name: 'Sai Sameer',
    email: 'sameer@example.com',
    phone: '9876543210'
  }
});

const structuredOrder = buildStructuredOrderObject(checkoutRes.order!, checkoutRes.razorpayOrder!);
console.log(JSON.stringify(structuredOrder, null, 2));

console.log('\n' + '='.repeat(80));
console.log('✅ DAY 9 CHECKPOINT COMPLETE: Contextual Upsell & Structured Order Verified');
console.log('='.repeat(80));
