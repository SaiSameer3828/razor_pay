import { runAgentTurn } from './agent/agentLoop.js';
import { addToCart, getCartSummary, resetCartStore } from './cart/cartManager.js';
import { evaluateCartRisk } from './security/riskEngine.js';

console.log('='.repeat(80));
console.log('🛡️  DAY 7 CHECKPOINT DEMO: BOUNDS, LIMITS & DYNAMIC RISK SCORING');
console.log('='.repeat(80));

// Test 1: Absurd Quantity Attempt
console.log('\n🚨 1. Absurd Quantity Attempt: User asks for 50 shirts:');
const sessionQty = 'demo_qty_test';
const qtyRes = addToCart(sessionQty, 'prod_oxford_shirt', 'var_ox_blu_l', 50);
console.log(`   ❌ Allowed: ${qtyRes.success ? 'YES' : 'BLOCKED 🛑'}`);
console.log(`   ⚠️  Explanation: ${qtyRes.message}`);

// Test 2: Absurd Order Value Attempt (> ₹50,000)
console.log('\n🚨 2. Absurd Order Value Attempt (> ₹50,000 Safety Ceiling):');
const sessionCeiling = 'demo_ceiling_test';
addToCart(sessionCeiling, 'prod_chronograph_watch', 'var_wtc_blk_onesize', 5); // ₹37,495
addToCart(sessionCeiling, 'prod_linen_blazer', 'var_blz_nvy_40', 4);        // ₹21,996
const ceilingSummary = getCartSummary(sessionCeiling);
console.log(`   • Total in Cart: ₹${ceilingSummary.pricing.totalInRupees.toFixed(2)}`);

const ceilingRisk = evaluateCartRisk(ceilingSummary);
console.log(`   • Risk Score: ${ceilingRisk.riskScore}/100 | Tier: ${ceilingRisk.riskLevel}`);
const ceilingTurn = await runAgentTurn(sessionCeiling, 'checkout');
console.log(`   🤖 Assistant Response:\n${ceilingTurn.assistantReply}`);

// Test 3: Elevated Risk Tier Order (> ₹20,000)
console.log('\n⚠️ 3. Elevated High-Value Order (₹20,000 - ₹50,000):');
const sessionElevated = 'demo_elevated_test';
addToCart(sessionElevated, 'prod_chronograph_watch', 'var_wtc_slv_onesize', 3); // ₹20,997
const elevatedSummary = getCartSummary(sessionElevated);
const elevatedRisk = evaluateCartRisk(elevatedSummary);
console.log(`   • Total: ₹${elevatedSummary.pricing.totalInRupees.toFixed(2)} | Risk Score: ${elevatedRisk.riskScore}/100 (Tier: ${elevatedRisk.riskLevel})`);
console.log(`   • Risk Factors: ${elevatedRisk.factors.join(', ')}`);
const elevatedTurn = await runAgentTurn(sessionElevated, 'checkout');
console.log(`   🤖 Assistant Response:\n${elevatedTurn.assistantReply}`);

// Test 4: Sane Low-Risk Cart
console.log('\n✅ 4. Sane Low-Risk Cart (₹3,987):');
const sessionLow = 'demo_low_risk_test';
const lowTurn = await runAgentTurn(sessionLow, 'add 2 blue shirts in size L');
const lowSummary = getCartSummary(sessionLow);
const lowRisk = evaluateCartRisk(lowSummary);
console.log(`   • Total: ₹${lowSummary.pricing.totalInRupees.toFixed(2)} | Risk Score: ${lowRisk.riskScore}/100 (Tier: ${lowRisk.riskLevel})`);
console.log(`   • Checkout Readiness: ${lowSummary.isReadyForCheckout ? 'READY ✅' : 'NOT READY'}`);

console.log('\n' + '='.repeat(80));
console.log('✅ DAY 7 CHECKPOINT COMPLETE: Financial Bounds & Risk Tiers Verified');
console.log('='.repeat(80));
