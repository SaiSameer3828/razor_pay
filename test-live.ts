import dotenv from 'dotenv';
dotenv.config();

import { addToCart, getCartSummary } from './src/cart/cartManager.js';
import { runAgentTurn } from './src/agent/agentLoop.js';
import { getRazorpayKeyId, isUsingMockKeys } from './src/razorpay/client.js';

async function main() {
  console.log('--- TEST LIVE AGENT CHECKOUT ---');
  console.log('Razorpay Key ID:', getRazorpayKeyId());
  console.log('isUsingMockKeys():', isUsingMockKeys());

  const SESSION = 'test_modal_session';
  const turn1 = await runAgentTurn(SESSION, 'add 2 blue oxford shirts in size L');
  console.log('\nTurn 1 (Add):', turn1.assistantReply);

  const turn2 = await runAgentTurn(SESSION, 'checkout');
  console.log('\nTurn 2 (Checkout):', turn2.assistantReply);

  const turn3 = await runAgentTurn(SESSION, 'yes confirm');
  console.log('\nTurn 3 (Confirm):', turn3.assistantReply);
}

main().catch(console.error);
