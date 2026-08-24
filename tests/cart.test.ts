import { describe, it, expect, beforeEach } from 'vitest';
import { CATALOG, getProductById, getVariantById, searchProducts } from '../src/catalog/products.js';
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  getCartSummary,
  applyCoupon,
  removeCoupon,
  clearCart,
  resetCartStore
} from '../src/cart/cartManager.js';

describe('Day 1 Checkpoint: Catalog & Pure Cart Engine', () => {
  beforeEach(() => {
    resetCartStore();
  });

  describe('1. Catalog Integrity & Lookup', () => {
    it('contains at least 8-10 rich products with valid variants', () => {
      expect(CATALOG.length).toBeGreaterThanOrEqual(8);
      for (const product of CATALOG) {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.variants.length).toBeGreaterThan(0);
        for (const variant of product.variants) {
          expect(variant.id).toBeDefined();
          expect(variant.sku).toBeDefined();
          expect(variant.priceInPaise).toBeGreaterThan(0);
          expect(variant.stock).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('can search products by text query, category, and budget', () => {
      const shirtResults = searchProducts('Oxford');
      expect(shirtResults.length).toBeGreaterThan(0);
      expect(shirtResults[0].id).toBe('prod_oxford_shirt');

      const affordableResults = searchProducts('shirt', { maxPriceInPaise: 200000 });
      expect(affordableResults.length).toBeGreaterThan(0);
      for (const p of affordableResults) {
        expect(p.variants.some(v => v.priceInPaise <= 200000)).toBe(true);
      }
    });

    it('fetches exact product and variant by ID', () => {
      const product = getProductById('prod_oxford_shirt');
      expect(product).toBeDefined();
      expect(product?.name).toBe('Classic Oxford Cotton Shirt');

      const variant = getVariantById('prod_oxford_shirt', 'var_ox_blu_l');
      expect(variant).toBeDefined();
      expect(variant?.color).toBe('Royal Oxford Blue');
      expect(variant?.size).toBe('L');
      expect(variant?.priceInPaise).toBe(189900);
    });
  });

  describe('2. Pure Cart Operations (Add, Update, Remove, Clear)', () => {
    const CART_ID = 'test_session_user_1';

    it('successfully adds an item to an empty cart', () => {
      const res = addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 2);
      expect(res.success).toBe(true);
      expect(res.cart).toBeDefined();
      expect(res.cart?.itemCount).toBe(1);
      expect(res.cart?.totalQuantity).toBe(2);
      expect(res.cart?.items[0].productName).toBe('Classic Oxford Cotton Shirt');
      expect(res.cart?.items[0].color).toBe('Royal Oxford Blue');
      expect(res.cart?.items[0].size).toBe('L');
      expect(res.cart?.items[0].quantity).toBe(2);
    });

    it('aggregates quantity when adding the same variant multiple times', () => {
      addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 1);
      const res = addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 2);

      expect(res.success).toBe(true);
      expect(res.cart?.itemCount).toBe(1);
      expect(res.cart?.totalQuantity).toBe(3);
    });

    it('updates quantity of an item in cart', () => {
      addToCart(CART_ID, 'prod_slim_chinos', 'var_chn_nvy_32', 1);
      const res = updateQuantity(CART_ID, 'prod_slim_chinos', 'var_chn_nvy_32', 4);

      expect(res.success).toBe(true);
      expect(res.cart?.items[0].quantity).toBe(4);
    });

    it('removes item from cart when quantity is updated to 0', () => {
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 2);
      const res = updateQuantity(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 0);

      expect(res.success).toBe(true);
      expect(res.cart?.itemCount).toBe(0);
    });

    it('removes an item explicitly', () => {
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
      addToCart(CART_ID, 'prod_leather_belt', 'var_blt_brn_32', 1);

      const res = removeFromCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize');
      expect(res.success).toBe(true);
      expect(res.cart?.itemCount).toBe(1);
      expect(res.cart?.items[0].productId).toBe('prod_leather_belt');
    });

    it('clears the entire cart', () => {
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
      addToCart(CART_ID, 'prod_leather_belt', 'var_blt_brn_32', 1);

      const res = clearCart(CART_ID);
      expect(res.success).toBe(true);
      expect(res.cart?.itemCount).toBe(0);
      expect(res.cart?.totalQuantity).toBe(0);
    });
  });

  describe('3. Deterministic Pricing, Taxes, Shipping & Coupons', () => {
    const CART_ID = 'pricing_test_cart';

    it('correctly calculates subtotal, 5% GST, and standard shipping below ₹2,000 threshold', () => {
      // 1x Heavyweight Minimalist Relaxed Tee = ₹999 (99,900 paise)
      addToCart(CART_ID, 'prod_heavyweight_tee', 'var_tee_blk_m', 1);

      const summary = getCartSummary(CART_ID);
      const p = summary.pricing;

      // Subtotal = ₹999 (99,900 paise)
      expect(p.subtotalInPaise).toBe(99900);
      expect(p.subtotalInRupees).toBe(999);

      // GST 5% of 99900 = 4995 paise = ₹49.95
      expect(p.taxInPaise).toBe(4995);
      expect(p.taxInRupees).toBe(49.95);

      // Below ₹2000 -> Shipping = ₹99 (9,900 paise)
      expect(p.shippingFeeInPaise).toBe(9900);
      expect(p.shippingFeeInRupees).toBe(99);

      // Total = 99900 + 4995 + 9900 = 114795 paise (₹1,147.95)
      expect(p.totalInPaise).toBe(114795);
      expect(p.totalInRupees).toBe(1147.95);
    });

    it('grants free shipping for orders above ₹2,000', () => {
      // 1x Italian Linen Blazer = ₹5,499 (549,900 paise)
      addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);

      const summary = getCartSummary(CART_ID);
      const p = summary.pricing;

      expect(p.subtotalInRupees).toBe(5499);
      expect(p.shippingFeeInPaise).toBe(0); // FREE SHIPPING
      expect(p.shippingFeeInRupees).toBe(0);

      // GST 5% of 549900 = 27495 paise = ₹274.95
      expect(p.taxInPaise).toBe(27495);
      expect(p.totalInPaise).toBe(549900 + 27495); // 577395 paise
    });

    it('correctly applies percentage coupon with cap (WELCOME10)', () => {
      // Add items worth ₹5,499
      addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);

      const res = applyCoupon(CART_ID, 'WELCOME10');
      expect(res.success).toBe(true);

      const summary = getCartSummary(CART_ID);
      const p = summary.pricing;

      // 10% of 549900 is 54990 paise, but WELCOME10 is capped at max ₹500 (50,000 paise)
      expect(p.discountInPaise).toBe(50000);
      expect(p.discountInRupees).toBe(500);

      // Taxable = 549900 - 50000 = 499900 paise
      // GST 5% on 499900 = 24995 paise = ₹249.95
      expect(p.taxInPaise).toBe(24995);
      expect(p.taxInRupees).toBe(249.95);

      // Total = 499900 (taxable) + 24995 (tax) + 0 (shipping) = 524895 paise (₹5,248.95)
      expect(p.totalInPaise).toBe(524895);
      expect(p.totalInRupees).toBe(5248.95);
    });

    it('rejects coupon if minimum order value is not met', () => {
      // Add item worth ₹999
      addToCart(CART_ID, 'prod_heavyweight_tee', 'var_tee_blk_m', 1);

      // FLAT500 requires ₹3,000 minimum
      const res = applyCoupon(CART_ID, 'FLAT500');
      expect(res.success).toBe(false);
      expect(res.error).toBe('COUPON_CRITERIA_NOT_MET');
    });

    it('removes applied coupon cleanly', () => {
      addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_40', 1);
      applyCoupon(CART_ID, 'WELCOME10');
      expect(getCartSummary(CART_ID).pricing.discountInPaise).toBeGreaterThan(0);

      removeCoupon(CART_ID);
      expect(getCartSummary(CART_ID).pricing.discountInPaise).toBe(0);
      expect(getCartSummary(CART_ID).pricing.couponCode).toBeUndefined();
    });
  });

  describe('4. Guardrails, Safety & Stock Limit Validation', () => {
    const CART_ID = 'guardrail_cart';

    it('refuses to add non-existent products', () => {
      const res = addToCart(CART_ID, 'non_existent_id', 'invalid_var', 1);
      expect(res.success).toBe(false);
      expect(res.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('refuses to add invalid variants for an existing product', () => {
      const res = addToCart(CART_ID, 'prod_oxford_shirt', 'invalid_var_id', 1);
      expect(res.success).toBe(false);
      expect(res.error).toBe('VARIANT_NOT_FOUND');
    });

    it('refuses negative or zero quantity', () => {
      const res = addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', 0);
      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_QUANTITY');

      const resNeg = addToCart(CART_ID, 'prod_oxford_shirt', 'var_ox_blu_l', -3);
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toBe('INVALID_QUANTITY');
    });

    it('prevents adding quantity exceeding available inventory', () => {
      // var_blz_nvy_42 has stock = 4
      const variant = getVariantById('prod_linen_blazer', 'var_blz_nvy_42');
      const maxStock = variant!.stock; // 4

      // Attempt to add 5 (within SKU limit of 5, but exceeds warehouse stock of 4)
      const res = addToCart(CART_ID, 'prod_linen_blazer', 'var_blz_nvy_42', 5);
      expect(res.success).toBe(false);
      expect(res.error).toBe('INSUFFICIENT_STOCK');
      expect(res.message).toContain(`Stock limit is ${maxStock}`);
    });

    it('identifies ready for checkout state correctly', () => {
      // Empty cart is not ready
      expect(getCartSummary(CART_ID).isReadyForCheckout).toBe(false);

      // In-stock items make it ready
      addToCart(CART_ID, 'prod_silk_tie', 'var_tie_bur_onesize', 1);
      expect(getCartSummary(CART_ID).isReadyForCheckout).toBe(true);
    });
  });
});
