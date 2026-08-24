export type OrderStatus = 'created' | 'attempted' | 'captured' | 'failed' | 'refunded';

export interface OrderItemSnapshot {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  color?: string;
  size?: string;
  unitPriceInPaise: number;
  quantity: number;
  totalPriceInPaise: number;
}

export interface InternalOrder {
  id: string; // e.g. 'ord_1724501234'
  cartId: string;
  userId?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: OrderStatus;
  subtotalInPaise: number;
  taxInPaise: number;
  shippingInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  currency: 'INR';
  itemsSnapshot: OrderItemSnapshot[];
  customerDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  capturedAt?: string;
}

export interface CheckoutFromCartResult {
  success: boolean;
  order?: InternalOrder;
  razorpayOrder?: {
    id: string;
    amount: number;
    currency: string;
    keyId: string;
  };
  error?: string;
  message: string;
}
