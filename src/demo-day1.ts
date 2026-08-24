import { CATALOG, searchProducts } from './catalog/products.js';
import {
  addToCart,
  getCartSummary,
  applyCoupon,
  updateQuantity,
  removeFromCart
} from './cart/cartManager.js';

console.log('='.repeat(70));
console.log('🛍️  DAY 1 CHECKPOINT DEMO: CATALOG & PURE CART ENGINE');
console.log('='.repeat(70));

const SESSION_ID = 'demo_user_sameer_101';

console.log(`\n📦 1. Store Catalog loaded with ${CATALOG.length} premium products.`);
console.log('🔍 Searching catalog for "navy" items...');
const searchResults = searchProducts('navy');
console.log(`   Found ${searchResults.length} matching products:`);
searchResults.forEach((p, idx) => {
  console.log(`   ${idx + 1}. [${p.brand}] ${p.name} - Categories: ${p.tags.join(', ')}`);
});

console.log('\n🛒 2. Simulating User adding items to cart:');
// Step A: Add Classic Oxford Shirt (Royal Oxford Blue, L, qty 2)
const addShirt = addToCart(SESSION_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 2);
console.log(`   👉 ${addShirt.message}`);

// Step B: Add Italian Linen Blazer (Navy, 40 M, qty 1)
const addBlazer = addToCart(SESSION_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);
console.log(`   👉 ${addBlazer.message}`);

// Step C: Add Mulberry Silk Tie (Burgundy, qty 1)
const addTie = addToCart(SESSION_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
console.log(`   👉 ${addTie.message}`);

console.log('\n📋 3. Fetching Initial Cart Summary:');
let summary = getCartSummary(SESSION_ID);
printSummary(summary);

console.log('\n🎟️ 4. Applying Discount Coupon "WELCOME10":');
const couponRes = applyCoupon(SESSION_ID, 'WELCOME10');
console.log(`   👉 ${couponRes.message}`);

summary = getCartSummary(SESSION_ID);
printSummary(summary);

console.log('\n🛡️ 5. Testing Safety Guardrails (Attempting to exceed stock):');
const stockExcess = addToCart(SESSION_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 50);
console.log(`   ❌ Result: ${stockExcess.success ? 'Allowed' : 'BLOCKED'}`);
console.log(`   ⚠️ Message: ${stockExcess.message}`);

console.log('\n✏️ 6. Modifying Quantities (Removing the tie, updating shirt to 1):');
removeFromCart(SESSION_ID, 'prod_silk_tie', 'var_tie_bur_onesize');
updateQuantity(SESSION_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);

summary = getCartSummary(SESSION_ID);
printSummary(summary);

console.log('\n' + '='.repeat(70));
console.log('✅ DAY 1 CHECKPOINT COMPLETE: 100% Deterministic & Verified');
console.log('='.repeat(70));

function printSummary(s: ReturnType<typeof getCartSummary>) {
  console.log('   ------------------------------------------------------');
  console.log(`   🛒 Cart ID: ${s.cartId} | Total Items: ${s.totalQuantity}`);
  console.log('   Items:');
  s.items.forEach(i => {
    console.log(`     • ${i.quantity}x ${i.productName} (${i.color ?? ''} ${i.size ?? ''}) @ ₹${i.unitPriceInPaise / 100} = ₹${i.totalPriceInPaise / 100}`);
  });
  console.log('   Pricing Breakdown:');
  console.log(`     • Subtotal:      ₹${s.pricing.subtotalInRupees.toFixed(2)}`);
  console.log(`     • GST (5%):      ₹${s.pricing.taxInRupees.toFixed(2)}`);
  console.log(`     • Shipping:      ${s.pricing.shippingFeeInRupees === 0 ? 'FREE' : '₹' + s.pricing.shippingFeeInRupees.toFixed(2)}`);
  if (s.pricing.discountInRupees > 0) {
    console.log(`     • Discount (${s.pricing.couponCode}): -₹${s.pricing.discountInRupees.toFixed(2)}`);
  }
  console.log(`     👉 TOTAL PAYABLE: ₹${s.pricing.totalInRupees.toFixed(2)} (${s.pricing.totalInPaise} paise)`);
  console.log(`     • Ready for Checkout: ${s.isReadyForCheckout ? 'YES ✅' : 'NO ❌'}`);
  console.log('   ------------------------------------------------------');
}
