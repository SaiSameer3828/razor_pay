import { getCartSummary } from '../cart/cartManager.js';
import { createRazorpayOrder } from '../razorpay/orderService.js';
import { RAZORPAY_KEY_ID } from '../razorpay/client.js';
import { InternalOrder, OrderStatus, CheckoutFromCartResult } from './types.js';

// Server-side In-Memory Order Storage (Maps internal order ID and Razorpay Order ID to records)
const ordersStore = new Map<string, InternalOrder>();
const razorpayOrderIndex = new Map<string, string>(); // razorpayOrderId -> internalOrderId

/**
 * Creates an immutable Order record by pulling deterministic pricing from cart summary,
 * then creates the corresponding Razorpay Order.
 */
export async function createOrderFromCart(
  cartId: string,
  options?: {
    userId?: string;
    customerDetails?: { name?: string; email?: string; phone?: string; address?: string };
  }
): Promise<CheckoutFromCartResult> {
  const summary = getCartSummary(cartId);

  // Guardrail 1: Cart must not be empty
  if (summary.items.length === 0) {
    return {
      success: false,
      message: 'Cannot create order: Cart is empty.',
      error: 'CART_EMPTY'
    };
  }

  // Guardrail 2: Stock & validation check
  if (!summary.isReadyForCheckout) {
    return {
      success: false,
      message: `Cannot checkout: ${summary.validationWarnings.join(' ')}`,
      error: 'CART_NOT_READY'
    };
  }

  const internalOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const receipt = `rcpt_${internalOrderId.slice(-10)}`;

  try {
    // Call Razorpay Order API with exact server-calculated total
    const rzpOrder = await createRazorpayOrder({
      amountInPaise: summary.pricing.totalInPaise,
      currency: summary.pricing.currency,
      receipt,
      notes: {
        internalOrderId,
        cartId,
        itemCount: summary.totalQuantity.toString(),
        couponApplied: summary.pricing.couponCode || 'NONE'
      }
    });

    const orderRecord: InternalOrder = {
      id: internalOrderId,
      cartId,
      userId: options?.userId,
      razorpayOrderId: rzpOrder.id,
      status: 'created',
      subtotalInPaise: summary.pricing.subtotalInPaise,
      taxInPaise: summary.pricing.taxInPaise,
      shippingInPaise: summary.pricing.shippingFeeInPaise,
      discountInPaise: summary.pricing.discountInPaise,
      totalInPaise: summary.pricing.totalInPaise,
      currency: 'INR',
      itemsSnapshot: summary.items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        color: i.color,
        size: i.size,
        unitPriceInPaise: i.unitPriceInPaise,
        quantity: i.quantity,
        totalPriceInPaise: i.totalPriceInPaise
      })),
      customerDetails: options?.customerDetails,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    ordersStore.set(internalOrderId, orderRecord);
    razorpayOrderIndex.set(rzpOrder.id, internalOrderId);

    return {
      success: true,
      message: `Order #${internalOrderId} created successfully. Total: ₹${summary.pricing.totalInRupees.toFixed(2)}`,
      order: orderRecord,
      razorpayOrder: {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: RAZORPAY_KEY_ID
      }
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to create payment order: ${(err as Error).message}`,
      error: 'ORDER_CREATION_FAILED'
    };
  }
}

/**
 * Updates order payment status (invoked by webhook or client verification)
 */
export function updateOrderStatus(
  razorpayOrderId: string,
  status: OrderStatus,
  details?: {
    paymentId?: string;
    signature?: string;
    failureReason?: string;
  }
): InternalOrder | null {
  const internalId = razorpayOrderIndex.get(razorpayOrderId);
  if (!internalId) return null;

  const order = ordersStore.get(internalId);
  if (!order) return null;

  order.status = status;
  if (details?.paymentId) order.razorpayPaymentId = details.paymentId;
  if (details?.signature) order.razorpaySignature = details.signature;
  if (details?.failureReason) order.failureReason = details.failureReason;

  if (status === 'captured') {
    order.capturedAt = new Date().toISOString();
  }

  order.updatedAt = new Date().toISOString();
  ordersStore.set(internalId, order);
  return order;
}

export function getOrderById(orderId: string): InternalOrder | undefined {
  return ordersStore.get(orderId);
}

export function getOrderByRazorpayOrderId(rzpOrderId: string): InternalOrder | undefined {
  const internalId = razorpayOrderIndex.get(rzpOrderId);
  if (!internalId) return undefined;
  return ordersStore.get(internalId);
}

export function resetOrderStore(): void {
  ordersStore.clear();
  razorpayOrderIndex.clear();
}
