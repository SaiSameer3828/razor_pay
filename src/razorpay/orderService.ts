import { getRazorpayClient, isUsingMockKeys } from './client.js';
import { CreateOrderParams, RazorpayOrderResponse } from './types.js';

/**
 * Creates an isolated Razorpay order.
 * If live test keys are configured, it makes the official API call to Razorpay.
 * If mock keys are active, it generates a standard RFC-compliant simulated order object.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResponse> {
  const { amountInPaise, currency = 'INR', receipt, notes = {} } = params;

  if (!amountInPaise || amountInPaise <= 0 || !Number.isInteger(amountInPaise)) {
    throw new Error('INVALID_AMOUNT: Amount must be a positive integer in lowest currency units (paise).');
  }

  if (!receipt) {
    throw new Error('INVALID_RECEIPT: Receipt identifier is required for tracking.');
  }

  if (isUsingMockKeys()) {
    // Simulated Razorpay Order Object (100% compliant with Razorpay API schema)
    const mockOrderId = `order_${Math.random().toString(36).substring(2, 14)}`;
    return {
      id: mockOrderId,
      entity: 'order',
      amount: amountInPaise,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt,
      status: 'created',
      attempts: 0,
      notes,
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  const razorpay = getRazorpayClient();
  const options = {
    amount: amountInPaise,
    currency,
    receipt,
    notes
  };

  const order = await razorpay.orders.create(options);
  return order as unknown as RazorpayOrderResponse;
}
