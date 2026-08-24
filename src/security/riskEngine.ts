import { CartSummary } from '../cart/types.js';
import { SAFETY_BOUNDS } from './bounds.js';

export type RiskLevel = 'LOW' | 'ELEVATED' | 'CRITICAL_BLOCKED';

export interface RiskEvaluation {
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  factors: string[];
  requiresElevatedConfirmation: boolean;
  isBlocked: boolean;
  blockedReason?: string;
}

/**
 * Evaluates cart state and calculates dynamic risk score
 */
export function evaluateCartRisk(cartSummary: CartSummary): RiskEvaluation {
  let score = 0;
  const factors: string[] = [];
  let isBlocked = false;
  let blockedReason: string | undefined = undefined;

  const totalPaise = cartSummary.pricing.totalInPaise;
  const totalQty = cartSummary.totalQuantity;

  // HARD BOUND CHECK 1: Exceeding maximum allowable order ceiling (₹50,000)
  if (totalPaise > SAFETY_BOUNDS.MAX_ORDER_VALUE_IN_PAISE) {
    isBlocked = true;
    blockedReason = `Order value (₹${(totalPaise / 100).toLocaleString('en-IN')}) exceeds the conversational safety ceiling of ₹${SAFETY_BOUNDS.MAX_ORDER_VALUE_IN_RUPEES.toLocaleString('en-IN')}. For large or wholesale purchases, please contact our enterprise desk.`;
    score = 100;
    factors.push('MAX_ORDER_VALUE_EXCEEDED');
  }

  // HARD BOUND CHECK 2: Exceeding total cart items limit
  if (totalQty > SAFETY_BOUNDS.MAX_TOTAL_ITEMS_IN_CART) {
    isBlocked = true;
    blockedReason = `Cart item count (${totalQty}) exceeds maximum allowable conversational cart limit (${SAFETY_BOUNDS.MAX_TOTAL_ITEMS_IN_CART} items).`;
    score = 100;
    factors.push('MAX_CART_ITEMS_EXCEEDED');
  }

  // Factor A: Order Value Spikes
  if (totalPaise >= 3500000) { // >= ₹35,000
    score += 45;
    factors.push('HIGH_ORDER_VALUE (>₹35,000)');
  } else if (totalPaise >= SAFETY_BOUNDS.HIGH_VALUE_THRESHOLD_IN_PAISE) { // >= ₹20,000
    score += 25;
    factors.push('ELEVATED_ORDER_VALUE (>₹20,000)');
  }

  // Factor B: High Single-Item Concentration (e.g. 4 or 5 of the same item)
  const hasHighConcentration = cartSummary.items.some(i => i.quantity >= 4);
  if (hasHighConcentration) {
    score += 20;
    factors.push('HIGH_SKU_CONCENTRATION (>=4 units of same item)');
  }

  // Factor C: High Line-Item Count (> 6 items)
  if (cartSummary.itemCount > 6) {
    score += 15;
    factors.push('HIGH_ITEM_COUNT (>6 unique SKUs)');
  }

  // Determine Risk Level
  let riskLevel: RiskLevel = 'LOW';
  if (isBlocked || score >= 70) {
    riskLevel = 'CRITICAL_BLOCKED';
  } else if (score >= 25) {
    riskLevel = 'ELEVATED';
  }

  return {
    riskScore: Math.min(score, 100),
    riskLevel,
    factors,
    requiresElevatedConfirmation: riskLevel === 'ELEVATED',
    isBlocked,
    blockedReason
  };
}
