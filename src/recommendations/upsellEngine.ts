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

// Curated Pairing Rules mapping
const UPSELL_RULES: Record<string, { targetProductId: string; targetVariantId: string; template: string }> = {
  // Oxford Shirt -> Silk Tie
  prod_oxford_shirt: {
    targetProductId: 'prod_silk_tie',
    targetVariantId: 'var_tie_bur_onesize',
    template: '💡 **Style Recommendation**: Pair your Oxford shirt with our **{productName} ({color})** for an additional **₹{price}**!'
  },
  // Linen Blazer -> Minimalist Chronograph Watch
  prod_linen_blazer: {
    targetProductId: 'prod_chronograph_watch',
    targetVariantId: 'var_wtc_slv_onesize',
    template: '💡 **Executive Upgrade**: Complete your blazer ensemble with our **{productName}** for **₹{price}**!'
  },
  // Chinos -> Full-Grain Leather Belt
  prod_stretch_chinos: {
    targetProductId: 'prod_leather_belt',
    targetVariantId: 'var_blt_brn_34',
    template: '💡 **Perfect Pairing**: Add our **{productName} ({color})** to match your chinos for +**₹{price}**!'
  },
  // Heavyweight Tee -> Weekender Canvas Duffle
  prod_heavyweight_tee: {
    targetProductId: 'prod_weekender_bag',
    targetVariantId: 'var_bag_olv_onesize',
    template: '💡 **Travel Companion**: Ready for a weekend trip? Add our rugged **{productName}** for **₹{price}**!'
  }
};

// Session tracking to ensure upsells are offered at most once per session
const sessionOfferedUpsells = new Map<string, Set<string>>();

/**
 * Generates a context-aware upsell recommendation based on live stock & live pricing
 */
export function getUpsellRecommendation(cart: CartSummary, sessionId?: string): UpsellRecommendation {
  if (cart.items.length === 0) {
    return { eligible: false };
  }

  const offeredSet = sessionId ? (sessionOfferedUpsells.get(sessionId) || new Set<string>()) : new Set<string>();

  for (const item of cart.items) {
    const rule = UPSELL_RULES[item.productId];
    if (rule) {
      // Check if already offered in this session
      if (offeredSet.has(rule.targetProductId)) {
        continue;
      }

      // Check if target item is already in the cart
      const alreadyInCart = cart.items.some(i => i.productId === rule.targetProductId);
      if (alreadyInCart) {
        continue;
      }

      // LIVE CATALOG & INVENTORY LOOKUP
      const targetProd = getProductById(rule.targetProductId);
      const targetVar = targetProd?.variants.find(v => v.id === rule.targetVariantId);

      // Verify variant exists AND is in stock
      if (targetProd && targetVar && targetVar.stock > 0) {
        const livePriceInRupees = targetVar.priceInPaise / 100;
        const pitch = rule.template
          .replace('{productName}', targetProd.name)
          .replace('{color}', targetVar.color || '')
          .replace('{price}', livePriceInRupees.toFixed(2));

        if (sessionId) {
          offeredSet.add(rule.targetProductId);
          sessionOfferedUpsells.set(sessionId, offeredSet);
        }

        return {
          eligible: true,
          baseProductId: item.productId,
          baseProductName: item.productName,
          recommendedProduct: targetProd,
          recommendedVariant: targetVar,
          pitchMessage: pitch,
          additionalPriceInRupees: livePriceInRupees
        };
      }
    }
  }

  return { eligible: false };
}

export function resetUpsellStore(): void {
  sessionOfferedUpsells.clear();
}
