import crypto from 'crypto';
import { RAZORPAY_KEY_SECRET } from './client.js';
import { VerifySignatureParams, VerificationResult } from './types.js';

/**
 * Verifies Razorpay payment signature using HMAC-SHA256
 * Signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
 */
export function verifyRazorpaySignature(params: VerifySignatureParams): VerificationResult {
  const { orderId, paymentId, signature, secret = RAZORPAY_KEY_SECRET } = params;

  if (!orderId || !paymentId || !signature) {
    return {
      isValid: false,
      orderId: orderId || '',
      paymentId: paymentId || '',
      verifiedAt: new Date().toISOString(),
      error: 'MISSING_PARAMETERS: orderId, paymentId, and signature are required.'
    };
  }

  try {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const isValid = expectedSignature === signature;

    return {
      isValid,
      orderId,
      paymentId,
      verifiedAt: new Date().toISOString(),
      error: isValid ? undefined : 'SIGNATURE_MISMATCH: Payment signature verification failed.'
    };
  } catch (err) {
    return {
      isValid: false,
      orderId,
      paymentId,
      verifiedAt: new Date().toISOString(),
      error: `VERIFICATION_ERROR: ${(err as Error).message}`
    };
  }
}

/**
 * Utility to generate a valid test signature (useful for automated testing)
 */
export function generateTestSignature(orderId: string, paymentId: string, secret: string = RAZORPAY_KEY_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}
