import { describe, it, expect } from 'vitest';
import { createRazorpayOrder } from '../src/razorpay/orderService.js';
import { verifyRazorpaySignature, generateTestSignature } from '../src/razorpay/verifyPayment.js';

describe('Day 2 Checkpoint: Isolated Razorpay Payment Flow', () => {
  describe('1. Order Creation Service', () => {
    it('creates an order with valid integer amount in paise and receipt', async () => {
      const order = await createRazorpayOrder({
        amountInPaise: 150000, // ₹1,500
        currency: 'INR',
        receipt: 'rcpt_test_101',
        notes: { test: 'isolated_day2' }
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.amount).toBe(150000);
      expect(order.currency).toBe('INR');
      expect(order.receipt).toBe('rcpt_test_101');
      expect(order.status).toBe('created');
    });

    it('rejects invalid, zero, or negative amounts', async () => {
      await expect(
        createRazorpayOrder({ amountInPaise: 0, receipt: 'rcpt_zero' })
      ).rejects.toThrow('INVALID_AMOUNT');

      await expect(
        createRazorpayOrder({ amountInPaise: -500, receipt: 'rcpt_neg' })
      ).rejects.toThrow('INVALID_AMOUNT');
    });

    it('rejects order without receipt identifier', async () => {
      await expect(
        createRazorpayOrder({ amountInPaise: 50000, receipt: '' })
      ).rejects.toThrow('INVALID_RECEIPT');
    });
  });

  describe('2. Cryptographic HMAC-SHA256 Signature Verification', () => {
    const testOrderId = 'order_test_887766';
    const testPaymentId = 'pay_test_998877';
    const testSecret = 'mock_secret_for_local_testing';

    it('authenticates a valid HMAC-SHA256 signature', () => {
      const validSignature = generateTestSignature(testOrderId, testPaymentId, testSecret);

      const verification = verifyRazorpaySignature({
        orderId: testOrderId,
        paymentId: testPaymentId,
        signature: validSignature,
        secret: testSecret
      });

      expect(verification.isValid).toBe(true);
      expect(verification.orderId).toBe(testOrderId);
      expect(verification.paymentId).toBe(testPaymentId);
      expect(verification.error).toBeUndefined();
    });

    it('detects and rejects tampered or forged signatures', () => {
      const forgedSignature = 'tampered_fake_signature_abc123';

      const verification = verifyRazorpaySignature({
        orderId: testOrderId,
        paymentId: testPaymentId,
        signature: forgedSignature,
        secret: testSecret
      });

      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('SIGNATURE_MISMATCH');
    });

    it('rejects verification requests with missing payload fields', () => {
      const result = verifyRazorpaySignature({
        orderId: '',
        paymentId: testPaymentId,
        signature: 'some_sig'
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('MISSING_PARAMETERS');
    });
  });
});
