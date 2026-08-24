import crypto from 'crypto';
import { updateOrderStatus, getOrderByRazorpayOrderId } from '../orders/orderManager.js';
import { RAZORPAY_KEY_SECRET } from './client.js';

export interface RazorpayWebhookPayload {
  entity: string; // 'event'
  account_id: string;
  event: 'payment.captured' | 'payment.failed' | 'payment.authorized' | 'order.paid';
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string; // e.g. 'pay_29QQoUBi66xm2f'
        order_id: string; // e.g. 'order_DBJOWzybf0sJbb'
        amount: number;
        currency: string;
        status: string;
        method: string;
        error_code?: string;
        error_description?: string;
        error_source?: string;
        error_reason?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        amount_paid: number;
        status: string;
      };
    };
  };
  created_at: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  event: string;
  orderId?: string;
  razorpayOrderId?: string;
  paymentId?: string;
  statusUpdatedTo?: string;
  message: string;
}

/**
 * Verifies the Webhook signature sent by Razorpay in the 'X-Razorpay-Signature' header
 * against the raw request body.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Processes verified Razorpay webhook events asynchronously
 */
export function processWebhookEvent(payload: RazorpayWebhookPayload): WebhookProcessingResult {
  const { event } = payload;
  const paymentEntity = payload.payload.payment?.entity;
  const orderEntity = payload.payload.order?.entity;

  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
  const paymentId = paymentEntity?.id;

  if (!razorpayOrderId) {
    return {
      success: false,
      event,
      message: 'Webhook payload missing order_id reference.'
    };
  }

  const existingOrder = getOrderByRazorpayOrderId(razorpayOrderId);
  if (!existingOrder) {
    return {
      success: false,
      event,
      razorpayOrderId,
      message: `No matching internal order found for Razorpay Order #${razorpayOrderId}.`
    };
  }

  switch (event) {
    case 'payment.captured':
    case 'order.paid': {
      const updated = updateOrderStatus(razorpayOrderId, 'captured', {
        paymentId: paymentId || existingOrder.razorpayPaymentId
      });
      return {
        success: true,
        event,
        orderId: existingOrder.id,
        razorpayOrderId,
        paymentId,
        statusUpdatedTo: updated?.status,
        message: `Order #${existingOrder.id} successfully marked as CAPTURED via Razorpay Webhook.`
      };
    }

    case 'payment.failed': {
      const failureReason = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed at gateway';
      const updated = updateOrderStatus(razorpayOrderId, 'failed', {
        paymentId,
        failureReason
      });
      return {
        success: true,
        event,
        orderId: existingOrder.id,
        razorpayOrderId,
        paymentId,
        statusUpdatedTo: updated?.status,
        message: `Order #${existingOrder.id} marked as FAILED via Razorpay Webhook (${failureReason}).`
      };
    }

    default:
      return {
        success: true,
        event,
        orderId: existingOrder.id,
        razorpayOrderId,
        message: `Unhandled event "${event}" acknowledged.`
      };
  }
}
