export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  brand: string;
  sku: string;
  color?: string;
  size?: string;
  unitPriceInPaise: number;
  quantity: number;
  totalPriceInPaise: number;
  featuredImage: string;
  inStock: boolean;
}

export interface PricingBreakdown {
  subtotalInPaise: number;
  subtotalInRupees: number;
  taxInPaise: number; // e.g. 5% GST
  taxInRupees: number;
  taxRatePercent: number;
  shippingFeeInPaise: number;
  shippingFeeInRupees: number;
  discountInPaise: number;
  discountInRupees: number;
  couponCode?: string;
  totalInPaise: number; // Final amount passed to Razorpay
  totalInRupees: number;
  currency: 'INR';
}

export interface CartSummary {
  cartId: string;
  itemCount: number;
  totalQuantity: number;
  items: CartItem[];
  pricing: PricingBreakdown;
  updatedAt: string;
  isReadyForCheckout: boolean;
  validationWarnings: string[];
}

export interface CartOperationResult {
  success: boolean;
  message: string;
  cart?: CartSummary;
  error?: string;
}
