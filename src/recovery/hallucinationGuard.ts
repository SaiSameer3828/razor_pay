import { CATALOG, searchProducts } from '../catalog/products.js';
import { recordAuditLog } from '../audit/auditLogger.js';

export interface HallucinationCheckResult {
  isHallucination: boolean;
  detectedUncataloguedEntity?: string;
  groundedCorrection?: string;
  suggestedAlternatives?: string[];
}

// Known common uncatalogued items to intercept immediately
const UNCATALOGUED_ITEMS = [
  'leather jacket', 'jacket', 'bomber jacket',
  'air jordan', 'nike', 'sneakers', 'running shoes', 'sandals',
  'sunglasses', 'perfume', 'cologne',
  'hoodie', 'sweatshirt',
  'jeans', 'denim', 'shorts',
  'silk pajamas', 'swimwear'
];

/**
 * Evaluates whether a user request or model intent refers to an out-of-catalog entity,
 * intercepting before false availability is claimed.
 */
export function interceptNearHallucination(
  sessionId: string,
  userMessage: string
): HallucinationCheckResult {
  const lower = userMessage.toLowerCase();

  // Check if user is asking for an uncatalogued entity
  for (const item of UNCATALOGUED_ITEMS) {
    if (lower.includes(item)) {
      // Check if catalog has any match
      const matches = searchProducts(item);
      if (matches.length === 0) {
        // Intercept near-hallucination!
        const alternatives = CATALOG.slice(0, 3).map(p => `${p.name} (${p.category})`);

        recordAuditLog({
          sessionId,
          turnIndex: 0,
          type: 'AGENT_THOUGHT',
          thought: `[NEAR-HALLUCINATION INTERCEPTED] User queried "${item}" which has 0 SKUs in active store catalog. Intercepted before false availability could be asserted.`,
          outcome: 'INFO',
          reason: `Out-of-catalog query: "${item}"`
        });

        return {
          isHallucination: true,
          detectedUncataloguedEntity: item,
          groundedCorrection: `We currently don't carry **${item}s** in our store catalog. However, we have in-stock premium **${CATALOG[0].name}**, **${CATALOG[1].name}**, and **${CATALOG[2].name}**!`,
          suggestedAlternatives: alternatives
        };
      }
    }
  }

  return { isHallucination: false };
}
