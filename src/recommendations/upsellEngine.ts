import { CartSummary } from '../cart/types.js';
import { getProductById } from '../catalog/products.js';
import { Product, ProductVariant } from '../catalog/types.js';

export interface UpsellRecommendation {
  eligible: boolean;
  baseProductId?: string;
  baseProductName?: string;
  recommendedProduct?: Product;
  recommendedVariant?: ProductVariant;
  pitchMessage?: string;
  additionalPriceInRupees?: number;
}

// Curated Pairing Rules
const UPSELL_RULES: Record<string, { targetProductId: string; targetVariantId: string; pitch: string }> = {
  // Oxford Shirt -> Silk Tie
  prod_oxford_shirt: {
    targetProductId: 'prod_silk_tie',
    targetVariantId: 'var_tie_bur_onesize',
    pitch: '💡 **Style Recommendation**: Pair your Oxford shirt with our **Pure Mulberry Silk Necktie (Burgundy Wine)** for an additional **₹899**!'
  },
  // Linen Blazer -> Minimalist Chronograph Watch
  prod_linen_blazer: {
    targetProductId: 'prod_chronograph_watch',
    targetVariantId: 'var_wtc_slv_onesize',
    pitch: '💡 **Executive Upgrade**: Complete your blazer ensemble with our **Heritage Minimalist Chronograph Watch** for **₹6,999**!'
  },
  // Chinos -> Full-Grain Leather Belt
  prod_stretch_chinos: {
    targetProductId: 'prod_leather_belt',
    targetVariantId: 'var_blt_brn_34',
    pitch: '💡 **Perfect Pairing**: Add our **Full-Grain Italian Leather Belt (Cognac Brown)** to match your chinos for +**₹1,499**!'
  },
  // Heavyweight Tee -> Weekender Canvas Duffle
  prod_heavyweight_tee: {
    targetProductId: 'prod_weekender_bag',
    targetVariantId: 'var_bag_olv_onesize',
    pitch: '💡 **Travel Companion**: Ready for a weekend trip? Add our rugged **Weekender Canvas Duffle Bag** for **₹4,499**!'
  }
};

/**
 * Generates a context-aware upsell recommendation based on items currently in the cart
 */
export function getUpsellRecommendation(cart: CartSummary): UpsellRecommendation {
  if (cart.items.length === 0) {
    return { eligible: false };
  }

  // Find the first item in cart that has an eligible upsell rule
  for (const item of cart.items) {
    const rule = UPSELL_RULES[item.productId];
    if (rule) {
      // Check if target item is already in cart to avoid recommending what they already have
      const alreadyInCart = cart.items.some(i => i.productId === rule.targetProductId);
      if (!alreadyInCart) {
        const targetProd = getProductById(rule.targetProductId);
        const targetVar = targetProd?.variants.find(v => v.id === rule.targetVariantId);

        if (targetProd && targetVar) {
          return {
            eligible: true,
            baseProductId: item.productId,
            baseProductName: item.productName,
            recommendedProduct: targetProd,
            recommendedVariant: targetVar,
            pitchMessage: rule.pitch,
            additionalPriceInRupees: targetVar.priceInPaise / 100
          };
        }
      }
    }
  }

  return { eligible: false };
}
