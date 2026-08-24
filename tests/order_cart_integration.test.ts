import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { addToCart, resetCartStore } from '../src/cart/cartManager.js';
import { createOrderFromCart, getOrderById, resetOrderStore } from '../src/orders/orderManager.js';
import { verifyWebhookSignature, processWebhookEvent, RazorpayWebhookPayload } from '../src/razorpay/webhookService.js';
import { RAZORPAY_KEY_SECRET } from '../src/razorpay/client.js';

describe('Day 3 Checkpoint: Cart to Razorpay Order & Webhook Pipeline', () => {
  beforeEach(() => {
    resetCartStore();
    resetOrderStore();
  });

  describe('1. Cart -> Razorpay Order Creation Flow', () => {
    const CART_ID = 'test_cart_day3_session';

    it('creates an internal order linked to a Razorpay Order with matching paise amount', async () => {
      // 1x Oxford Shirt (189900 paise) + 1x Linen Blazer (549900 paise)
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
      addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);

      // Subtotal = 189900 + 549900 = 739800 paise
      // GST 5% = 36990 paise
      // Free Shipping = 0
      // Expected Total = 776790 paise (₹7,767.90)

      const result = await createOrderFromCart(CART_ID, {
        userId: 'usr_sameer_99',
        customerDetails: {
          name: 'Sai Sameer',
          email: 'saisameer@example.com',
          phone: '9876543210'
        }
      });

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.razorpayOrder).toBeDefined();

      const order = result.order!;
      expect(order.cartId).toBe(CART_ID);
      expect(order.subtotalInPaise).toBe(739800);
      expect(order.taxInPaise).toBe(36990);
      expect(order.totalInPaise).toBe(776790);
      expect(order.status).toBe('created');
      expect(order.itemsSnapshot.length).toBe(2);

      expect(result.razorpayOrder?.amount).toBe(776790);
      expect(result.razorpayOrder?.id).toBe(order.razorpayOrderId);
    });

    it('rejects order creation for an empty cart', async () => {
      const result = await createOrderFromCart('empty_cart_id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('CART_EMPTY');
    });
  });

  describe('2. Server-to-Server Webhook Signature & Event Processing', () => {
    const CART_ID = 'test_webhook_cart';

    it('processes a verified payment.captured webhook and transitions order to captured', async () => {
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
      const checkout = await createOrderFromCart(CART_ID);
      const rzpOrderId = checkout.razorpayOrder!.id;
      const internalOrderId = checkout.order!.id;

      // Simulated Razorpay Webhook Payload
      const webhookPayload: RazorpayWebhookPayload = {
        entity: 'event',
        account_id: 'acc_test_123',
        event: 'payment.captured',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_mock_payment_999',
              order_id: rzpOrderId,
              amount: checkout.razorpayOrder!.amount,
              currency: 'INR',
              status: 'captured',
              method: 'upi'
            }
          }
        },
        created_at: Math.floor(Date.now() / 1000)
      };

      const rawPayload = JSON.stringify(webhookPayload);
      const validSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(rawPayload)
        .digest('hex');

      // 1. Verify Webhook Signature
      const isSignatureValid = verifyWebhookSignature(rawPayload, validSignature, RAZORPAY_KEY_SECRET);
      expect(isSignatureValid).toBe(true);

      // 2. Process Webhook Event
      const processResult = processWebhookEvent(webhookPayload);
      expect(processResult.success).toBe(true);
      expect(processResult.statusUpdatedTo).toBe('captured');

      // 3. Verify Internal Order State is now CAPTURED
      const updatedOrder = getOrderById(internalOrderId);
      expect(updatedOrder?.status).toBe('captured');
      expect(updatedOrder?.razorpayPaymentId).toBe('pay_rzp_mock_payment_999');
      expect(updatedOrder?.capturedAt).toBeDefined();
    });

    it('processes a payment.failed webhook and records failure reason', async () => {
      addToCart(CART_ID, 'prod_heavyweight_tee', 'var_tee_blk_m', 1);
      const checkout = await createOrderFromCart(CART_ID);
      const rzpOrderId = checkout.razorpayOrder!.id;
      const internalOrderId = checkout.order!.id;

      const failedWebhookPayload: RazorpayWebhookPayload = {
        entity: 'event',
        account_id: 'acc_test_123',
        event: 'payment.failed',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_456',
              order_id: rzpOrderId,
              amount: checkout.razorpayOrder!.amount,
              currency: 'INR',
              status: 'failed',
              method: 'card',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment was declined by issuing bank (Insufficient Funds)'
            }
          }
        },
        created_at: Math.floor(Date.now() / 1000)
      };

      const processResult = processWebhookEvent(failedWebhookPayload);
      expect(processResult.success).toBe(true);
      expect(processResult.statusUpdatedTo).toBe('failed');

      const failedOrder = getOrderById(internalOrderId);
      expect(failedOrder?.status).toBe('failed');
      expect(failedOrder?.failureReason).toContain('Payment was declined by issuing bank');
    });

    it('rejects forged webhook signatures', () => {
      const rawPayload = '{"fake":"payload"}';
      const fakeSignature = 'forged_signature_123456';

      const isValid = verifyWebhookSignature(rawPayload, fakeSignature, RAZORPAY_KEY_SECRET);
      expect(isValid).toBe(false);
    });
  });
});
