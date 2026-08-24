import { getProductById, getVariantById } from '../catalog/products.js';
import { CartItem, CartSummary, CartOperationResult, PricingBreakdown } from './types.js';

interface RawCartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CartState {
  cartId: string;
  items: RawCartItem[];
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-Memory store for fast, deterministic session cart storage (can be swapped with Postgres/Redis)
const cartStore = new Map<string, CartState>();

// Coupons configuration
const VALID_COUPONS: Record<string, { type: 'percent' | 'flat'; value: number; minOrderInPaise?: number; maxDiscountInPaise?: number; description: string }> = {
  'WELCOME10': {
    type: 'percent',
    value: 10,
    minOrderInPaise: 100000, // ₹1,000 min order
    maxDiscountInPaise: 50000, // max ₹500 discount
    description: '10% off up to ₹500 on orders above ₹1,000'
  },
  'FLAT500': {
    type: 'flat',
    value: 50000, // ₹500
    minOrderInPaise: 300000, // ₹3,000 min order
    description: 'Flat ₹500 off on orders above ₹3,000'
  }
};

/**
 * Retrieves or creates a cart state
 */
export function getOrCreateCart(cartId: string): CartState {
  let cart = cartStore.get(cartId);
  if (!cart) {
    cart = {
      cartId,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    cartStore.set(cartId, cart);
  }
  return cart;
}

/**
 * Calculates deterministic pricing breakdown
 */
export function calculatePricing(rawItems: RawCartItem[], couponCode?: string): { pricing: PricingBreakdown; enrichedItems: CartItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const enrichedItems: CartItem[] = [];
  let subtotalInPaise = 0;

  for (const raw of rawItems) {
    const product = getProductById(raw.productId);
    const variant = getVariantById(raw.productId, raw.variantId);

    if (!product || !variant) {
      warnings.push(`Item (ID: ${raw.productId}, Variant: ${raw.variantId}) is no longer available.`);
      continue;
    }

    const inStock = variant.stock >= raw.quantity;
    if (!inStock) {
      warnings.push(`Only ${variant.stock} unit(s) of "${product.name} (${variant.color ?? ''} ${variant.size ?? ''})' available in stock.`);
    }

    const itemTotal = variant.priceInPaise * raw.quantity;
    subtotalInPaise += itemTotal;

    enrichedItems.push({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      brand: product.brand,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      unitPriceInPaise: variant.priceInPaise,
      quantity: raw.quantity,
      totalPriceInPaise: itemTotal,
      featuredImage: product.featuredImage,
      inStock
    });
  }

  // 1. GST (Apparel/Lifestyle rate standard: 5%)
  const GST_RATE_PERCENT = 5;
  const taxInPaise = Math.round((subtotalInPaise * GST_RATE_PERCENT) / 100);

  // 2. Shipping: Free on orders >= ₹2,000 (200,000 paise), else ₹99 (9,900 paise)
  const shippingFeeInPaise = subtotalInPaise === 0 ? 0 : (subtotalInPaise >= 200000 ? 0 : 9900);

  // 3. Discount calculation
  let discountInPaise = 0;
  let appliedCoupon: string | undefined = undefined;

  if (couponCode && VALID_COUPONS[couponCode.toUpperCase()]) {
    const coupon = VALID_COUPONS[couponCode.toUpperCase()];
    const minOrder = coupon.minOrderInPaise ?? 0;

    if (subtotalInPaise >= minOrder) {
      appliedCoupon = couponCode.toUpperCase();
      if (coupon.type === 'percent') {
        const calculated = Math.round((subtotalInPaise * coupon.value) / 100);
        discountInPaise = coupon.maxDiscountInPaise ? Math.min(calculated, coupon.maxDiscountInPaise) : calculated;
      } else if (coupon.type === 'flat') {
        discountInPaise = Math.min(coupon.value, subtotalInPaise);
      }
    } else {
      warnings.push(`Coupon "${couponCode}" requires a minimum order of ₹${minOrder / 100}.`);
    }
  } else if (couponCode) {
    warnings.push(`Coupon "${couponCode}" is invalid or expired.`);
  }

  // 4. Final Total (in paise)
  const totalInPaise = Math.max(0, subtotalInPaise + taxInPaise + shippingFeeInPaise - discountInPaise);

  const pricing: PricingBreakdown = {
    subtotalInPaise,
    subtotalInRupees: subtotalInPaise / 100,
    taxInPaise,
    taxInRupees: taxInPaise / 100,
    taxRatePercent: GST_RATE_PERCENT,
    shippingFeeInPaise,
    shippingFeeInRupees: shippingFeeInPaise / 100,
    discountInPaise,
    discountInRupees: discountInPaise / 100,
    couponCode: appliedCoupon,
    totalInPaise,
    totalInRupees: totalInPaise / 100,
    currency: 'INR'
  };

  return { pricing, enrichedItems, warnings };
}

/**
 * Pure cart summary retrieval
 */
export function getCartSummary(cartId: string): CartSummary {
  const cart = getOrCreateCart(cartId);
  const { pricing, enrichedItems, warnings } = calculatePricing(cart.items, cart.couponCode);

  const totalQuantity = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
  const allInStock = enrichedItems.length > 0 && enrichedItems.every(item => item.inStock);

  return {
    cartId,
    itemCount: enrichedItems.length,
    totalQuantity,
    items: enrichedItems,
    pricing,
    updatedAt: cart.updatedAt.toISOString(),
    isReadyForCheckout: allInStock && enrichedItems.length > 0,
    validationWarnings: warnings
  };
}

/**
 * Pure function to add item to cart
 */
export function addToCart(cartId: string, productId: string, variantId: string, quantity: number = 1): CartOperationResult {
  if (quantity <= 0) {
    return { success: false, message: 'Quantity must be at least 1.', error: 'INVALID_QUANTITY' };
  }

  const product = getProductById(productId);
  if (!product) {
    return { success: false, message: `Product "${productId}" not found in catalog.`, error: 'PRODUCT_NOT_FOUND' };
  }

  const variant = getVariantById(productId, variantId);
  if (!variant) {
    return { success: false, message: `Variant "${variantId}" not found for product "${product.name}".`, error: 'VARIANT_NOT_FOUND' };
  }

  const cart = getOrCreateCart(cartId);
  const existingItemIndex = cart.items.findIndex(i => i.productId === productId && i.variantId === variantId);

  const currentQtyInCart = existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity : 0;
  const newTotalQty = currentQtyInCart + quantity;

  if (newTotalQty > variant.stock) {
    return {
      success: false,
      message: `Cannot add ${quantity} item(s). Stock limit is ${variant.stock} (you already have ${currentQtyInCart} in cart).`,
      error: 'INSUFFICIENT_STOCK',
      cart: getCartSummary(cartId)
    };
  }

  if (existingItemIndex >= 0) {
    cart.items[existingItemIndex].quantity = newTotalQty;
  } else {
    cart.items.push({ productId, variantId, quantity });
  }

  cart.updatedAt = new Date();
  return {
    success: true,
    message: `Added ${quantity}x "${product.name} (${variant.color ?? ''} ${variant.size ?? ''})" to cart.`,
    cart: getCartSummary(cartId)
  };
}

/**
 * Pure function to update item quantity in cart
 */
export function updateQuantity(cartId: string, productId: string, variantId: string, quantity: number): CartOperationResult {
  const cart = getOrCreateCart(cartId);
  const existingIndex = cart.items.findIndex(i => i.productId === productId && i.variantId === variantId);

  if (existingIndex < 0) {
    return { success: false, message: 'Item is not in the cart.', error: 'ITEM_NOT_IN_CART' };
  }

  if (quantity <= 0) {
    // If quantity is 0 or negative, remove the item
    return removeFromCart(cartId, productId, variantId);
  }

  const variant = getVariantById(productId, variantId);
  if (!variant) {
    return { success: false, message: 'Variant not found in catalog.', error: 'VARIANT_NOT_FOUND' };
  }

  if (quantity > variant.stock) {
    return {
      success: false,
      message: `Requested quantity (${quantity}) exceeds available stock (${variant.stock}).`,
      error: 'INSUFFICIENT_STOCK',
      cart: getCartSummary(cartId)
    };
  }

  cart.items[existingIndex].quantity = quantity;
  cart.updatedAt = new Date();

  return {
    success: true,
    message: `Updated quantity to ${quantity}.`,
    cart: getCartSummary(cartId)
  };
}

/**
 * Pure function to remove item from cart
 */
export function removeFromCart(cartId: string, productId: string, variantId: string): CartOperationResult {
  const cart = getOrCreateCart(cartId);
  const initialLength = cart.items.length;
  cart.items = cart.items.filter(i => !(i.productId === productId && i.variantId === variantId));

  if (cart.items.length === initialLength) {
    return { success: false, message: 'Item was not in cart.', error: 'ITEM_NOT_IN_CART' };
  }

  cart.updatedAt = new Date();
  return {
    success: true,
    message: 'Item removed from cart.',
    cart: getCartSummary(cartId)
  };
}

/**
 * Pure function to apply coupon
 */
export function applyCoupon(cartId: string, couponCode: string): CartOperationResult {
  const cart = getOrCreateCart(cartId);
  const code = couponCode.trim().toUpperCase();

  if (!VALID_COUPONS[code]) {
    return { success: false, message: `Invalid coupon code "${couponCode}".`, error: 'INVALID_COUPON', cart: getCartSummary(cartId) };
  }

  cart.couponCode = code;
  cart.updatedAt = new Date();
  const summary = getCartSummary(cartId);

  if (summary.pricing.couponCode !== code) {
    return {
      success: false,
      message: `Coupon "${code}" could not be applied. ${summary.validationWarnings.join(' ')}`,
      error: 'COUPON_CRITERIA_NOT_MET',
      cart: summary
    };
  }

  return {
    success: true,
    message: `Applied coupon "${code}": ${VALID_COUPONS[code].description}`,
    cart: summary
  };
}

/**
 * Pure function to remove coupon
 */
export function removeCoupon(cartId: string): CartOperationResult {
  const cart = getOrCreateCart(cartId);
  cart.couponCode = undefined;
  cart.updatedAt = new Date();
  return {
    success: true,
    message: 'Coupon removed.',
    cart: getCartSummary(cartId)
  };
}

/**
 * Clears all items in a cart
 */
export function clearCart(cartId: string): CartOperationResult {
  const cart = getOrCreateCart(cartId);
  cart.items = [];
  cart.couponCode = undefined;
  cart.updatedAt = new Date();
  return {
    success: true,
    message: 'Cart cleared.',
    cart: getCartSummary(cartId)
  };
}

/**
 * Reset cart store (useful for clean unit tests)
 */
export function resetCartStore(): void {
  cartStore.clear();
}
