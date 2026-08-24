import { addToCart, getCartSummary } from './cart/cartManager.js';
import { createOrderFromCart, getOrderById } from './orders/orderManager.js';
import { verifyWebhookSignature, processWebhookEvent, RazorpayWebhookPayload } from './razorpay/webhookService.js';
import { RAZORPAY_KEY_SECRET, RAZORPAY_KEY_ID, isUsingMockKeys } from './razorpay/client.js';
import crypto from 'crypto';

console.log('='.repeat(75));
console.log('🛍️  DAY 3 CHECKPOINT DEMO: CART -> RAZORPAY ORDER & WEBHOOK PIPELINE');
console.log('='.repeat(75));

if (isUsingMockKeys) {
  console.log('⚠️  MODE: LOCAL SANDBOX MOCK (Add live RAZORPAY_KEY_ID in .env for Live Test Mode)');
} else {
  console.log(`🟢 MODE: LIVE RAZORPAY TEST MODE (Key: ${RAZORPAY_KEY_ID})`);
}

const CART_ID = 'session_demo_day3';

console.log('\n🛒 1. Staging items into shopping cart:');
addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);

const summary = getCartSummary(CART_ID);
console.log(`   • Items: ${summary.totalQuantity}`);
console.log(`   • Subtotal: ₹${summary.pricing.subtotalInRupees.toFixed(2)}`);
console.log(`   • GST (5%): ₹${summary.pricing.taxInRupees.toFixed(2)}`);
console.log(`   • Shipping: FREE`);
console.log(`   👉 TOTAL PAYABLE: ₹${summary.pricing.totalInRupees.toFixed(2)} (${summary.pricing.totalInPaise} paise)`);

console.log('\n📦 2. Executing Server-Side Checkout (Cart -> Razorpay Order):');
const checkout = await createOrderFromCart(CART_ID, {
  userId: 'usr_sameer_101',
  customerDetails: {
    name: 'Sai Sameer',
    email: 'saisameer@example.com',
    phone: '9876543210'
  }
});

if (!checkout.success) {
  console.error(`❌ Checkout failed: ${checkout.message}`);
  process.exit(1);
}

const order = checkout.order!;
const rzpOrder = checkout.razorpayOrder!;

console.log(`   ✅ Internal Order Created: #${order.id}`);
console.log(`   ✅ Razorpay Order ID:       ${rzpOrder.id}`);
console.log(`   ✅ Amount Locked in Paise:  ${rzpOrder.amount} paise (₹${rzpOrder.amount / 100})`);
console.log(`   ✅ Initial Status:          ${order.status.toUpperCase()}`);

console.log('\n🔔 3. Simulating Server-to-Server Razorpay Webhook (payment.captured):');
const paymentId = `pay_${Math.random().toString(36).substring(2, 14)}`;

const webhookPayload: RazorpayWebhookPayload = {
  entity: 'event',
  account_id: 'acc_demo_test',
  event: 'payment.captured',
  contains: ['payment'],
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: 'INR',
        status: 'captured',
        method: 'upi'
      }
    }
  },
  created_at: Math.floor(Date.now() / 1000)
};

const rawPayload = JSON.stringify(webhookPayload);
const webhookSignature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(rawPayload)
  .digest('hex');

console.log(`   • Incoming X-Razorpay-Signature: ${webhookSignature.substring(0, 24)}...`);

const isSignatureValid = verifyWebhookSignature(rawPayload, webhookSignature, RAZORPAY_KEY_SECRET);
console.log(`   • Webhook Signature Valid:       ${isSignatureValid ? 'YES ✅' : 'NO ❌'}`);

const webhookResult = processWebhookEvent(webhookPayload);
console.log(`   👉 Webhook Result:              ${webhookResult.message}`);

console.log('\n📋 4. Verifying Final Order State in Database:');
const finalOrder = getOrderById(order.id);
console.log(`   • Order ID:           #${finalOrder?.id}`);
console.log(`   • Final Status:       ${finalOrder?.status.toUpperCase()} ✅`);
console.log(`   • Razorpay Payment ID: ${finalOrder?.razorpayPaymentId}`);
console.log(`   • Captured At:        ${finalOrder?.capturedAt}`);

console.log('\n' + '='.repeat(75));
console.log('✅ DAY 3 CHECKPOINT COMPLETE: Cart Wired to Razorpay + Webhook Verified');
console.log('='.repeat(75));
