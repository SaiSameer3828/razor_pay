import { InternalOrder } from './types.js';
import { RazorpayOrder } from '../razorpay/types.js';
import { RiskEvaluation } from '../security/riskEngine.js';
import { getProductById } from '../catalog/products.js';

export interface StructuredOrderLineItem {
  sku: string;
  name: string;
  color?: string;
  size?: string;
  unitPriceInRupees: number;
  quantity: number;
  lineTotalInRupees: number;
  image?: string;
}

export interface StructuredOrderFinancials {
  subtotalInRupees: number;
  discountInRupees: number;
  taxableAmountInRupees: number;
  gstInRupees: number;
  shippingInRupees: number;
  totalPayableInRupees: number;
  currency: string;
}

export interface StructuredOrderObject {
  schemaVersion: string;
  orderId: string;
  orderStatus: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  lineItems: StructuredOrderLineItem[];
  financials: StructuredOrderFinancials;
  paymentGateway: {
    provider: 'Razorpay';
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    signatureVerified: boolean;
    mode: 'TEST' | 'LIVE';
  };
  securityAudit: {
    confirmationState: string;
    riskScore: number;
    riskTier: string;
    isPriceSnapshotted: boolean;
  };
  nextActions: string[];
}

/**
 * Transforms internal order state and Razorpay metadata into a rich, agent-consumable object
 */
export function buildStructuredOrderObject(
  order: InternalOrder,
  razorpayOrder: { id: string; amount: number; currency: string },
  riskEvaluation?: RiskEvaluation
): StructuredOrderObject {
  const lineItems: StructuredOrderLineItem[] = order.itemsSnapshot.map(item => {
    const prod = getProductById(item.productId);
    const variant = prod?.variants.find(v => v.id === item.variantId);
    return {
      sku: item.sku,
      name: item.productName,
      color: item.color,
      size: item.size,
      unitPriceInRupees: item.unitPriceInPaise / 100,
      quantity: item.quantity,
      lineTotalInRupees: item.totalPriceInPaise / 100,
      image: prod?.featuredImage || ''
    };
  });

  const taxablePaise = Math.max(0, order.subtotalInPaise - order.discountInPaise);

  const financials: StructuredOrderFinancials = {
    subtotalInRupees: order.subtotalInPaise / 100,
    discountInRupees: order.discountInPaise / 100,
    taxableAmountInRupees: taxablePaise / 100,
    gstInRupees: order.taxInPaise / 100,
    shippingInRupees: order.shippingInPaise / 100,
    totalPayableInRupees: order.totalInPaise / 100,
    currency: order.currency
  };

  return {
    schemaVersion: '2026-08-24.v1',
    orderId: order.id,
    orderStatus: order.status,
    createdAt: order.createdAt,
    customer: {
      name: order.customerDetails?.name || 'Customer',
      email: order.customerDetails?.email || 'customer@example.com',
      phone: order.customerDetails?.phone || '9999999999'
    },
    lineItems,
    financials,
    paymentGateway: {
      provider: 'Razorpay',
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: order.razorpayPaymentId,
      signatureVerified: !!order.razorpaySignature,
      mode: 'TEST'
    },
    securityAudit: {
      confirmationState: 'CONFIRMED_READY_FOR_PAYMENT',
      riskScore: riskEvaluation?.riskScore || 0,
      riskTier: riskEvaluation?.riskLevel || 'LOW',
      isPriceSnapshotted: true
    },
    nextActions: [
      'Complete 2FA/UPI verification on Razorpay modal',
      'Download PDF tax invoice',
      'Receive WhatsApp/SMS dispatch notification'
    ]
  };
}
