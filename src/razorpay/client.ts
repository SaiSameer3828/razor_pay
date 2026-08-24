import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

export function getRazorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key';
}

export function getRazorpayKeySecret(): string {
  return process.env.RAZORPAY_KEY_SECRET || 'mock_secret_for_local_testing';
}

export function isUsingMockKeys(): boolean {
  const key = getRazorpayKeyId();
  if (process.env.NODE_ENV === 'test') return true;
  if (!key || key === 'rzp_test_mock_key' || key === 'rzp_test_placeholder_key') return true;
  return false;
}

export const RAZORPAY_KEY_ID = getRazorpayKeyId();
export const RAZORPAY_KEY_SECRET = getRazorpayKeySecret();

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret
    });
  }
  return razorpayInstance;
}
