import { CartSummary } from '../cart/types.js';
import { updateOrderStatus, getOrderById } from '../orders/orderManager.js';
import { recordAuditLog } from '../audit/auditLogger.js';

export interface DeclineRecoveryResult {
  isRecovered: boolean;
  orderId: string;
  cartId: string;
  bankDeclineReason: string;
  plainEnglishExplanation: string;
  cartPreserved: boolean;
  cartSummary: CartSummary;
  retryOptions: string[];
}

/**
 * Handles Razorpay payment declines, preserving cart state and providing human-friendly retry options
 */
export function handlePaymentDecline(
  razorpayOrderId: string,
  declineErrorCode: string,
  declineDescription: string,
  currentCart: CartSummary
): DeclineRecoveryResult {
  const updatedOrder = updateOrderStatus(razorpayOrderId, 'failed', {
    failureReason: `${declineErrorCode}: ${declineDescription}`
  });

  const orderId = updatedOrder?.id || 'unknown_order';
  const cartId = updatedOrder?.cartId || currentCart.cartId;

  // Translate technical gateway error codes to friendly customer language
  let friendlyReason = 'The bank was unable to complete the transaction.';
  if (declineErrorCode.includes('INSUFFICIENT') || declineDescription.toLowerCase().includes('insufficient')) {
    friendlyReason = 'Your card or account had insufficient funds for this purchase.';
  } else if (declineErrorCode.includes('EXPIRED') || declineDescription.toLowerCase().includes('expired')) {
    friendlyReason = 'The payment card entered appears to be expired.';
  } else if (declineErrorCode.includes('TIMEOUT') || declineDescription.toLowerCase().includes('timeout')) {
    friendlyReason = 'The bank authorization session timed out.';
  } else if (declineErrorCode.includes('DECLINED') || declineDescription.toLowerCase().includes('declined')) {
    friendlyReason = 'The transaction was declined by your issuing bank.';
  }

  recordAuditLog({
    sessionId: cartId,
    turnIndex: 0,
    type: 'PAYMENT_EVENT',
    thought: `Payment failed for Razorpay Order #${razorpayOrderId}. Reason: ${declineDescription}. Preserving cart #${cartId} (${currentCart.totalQuantity} items).`,
    outcome: 'FAILED',
    reason: `${declineErrorCode}: ${declineDescription}`,
    result: {
      orderId,
      cartPreserved: true,
      preservedTotalInPaise: currentCart.pricing.totalInPaise
    }
  });

  return {
    isRecovered: true,
    orderId,
    cartId,
    bankDeclineReason: declineDescription,
    plainEnglishExplanation: `⚠️ **Payment Did Not Go Through**\n\n${friendlyReason}\n\nDon't worry — your cart of **${currentCart.totalQuantity} item(s)** (₹${currentCart.pricing.totalInRupees.toFixed(2)}) is completely safe and preserved.`,
    cartPreserved: true,
    cartSummary: currentCart,
    retryOptions: ['Retry with UPI', 'Try a different Card', 'Netbanking', 'Adjust Cart']
  };
}
