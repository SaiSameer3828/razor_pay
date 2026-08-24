import { dispatchToolCall } from './toolDispatcher.js';
import { AgentResponse, AgentThoughtStep } from './types.js';
import { getCartSummary, addToCart } from '../cart/cartManager.js';
import { evaluateCartRisk } from '../security/riskEngine.js';
import { interceptNearHallucination } from '../recovery/hallucinationGuard.js';
import { getUpsellRecommendation } from '../recommendations/upsellEngine.js';
import {
  getSessionGate,
  recordExplicitHumanConfirmation
} from './confirmationGate.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SessionContext {
  sessionId: string;
  turnIndex: number;
  history: Message[];
}

const sessionStore = new Map<string, SessionContext>();
const MAX_REACT_STEPS = 5; // Hard cap on tool reasoning iterations per turn

export function getOrCreateSession(sessionId: string): SessionContext {
  let session = sessionStore.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      turnIndex: 0,
      history: []
    };
    sessionStore.set(sessionId, session);
  }
  return session;
}

export function resetAgentSessions(): void {
  sessionStore.clear();
}

/**
 * ReAct Agent Orchestrator with Hard Cap and Human-in-the-Loop Confirmation Gate
 */
export async function runAgentTurn(sessionId: string, userMessage: string): Promise<AgentResponse> {
  const session = getOrCreateSession(sessionId);
  session.turnIndex += 1;
  session.history.push({ role: 'user', content: userMessage });

  const thoughtSteps: AgentThoughtStep[] = [];
  let assistantReply = '';

  const lowerMsg = userMessage.toLowerCase().trim();
  const gate = getSessionGate(sessionId);

  // =========================================================================
  // SCENARIO A: EXPLICIT CONFIRMATION TO PAY ("yes confirm", "proceed with payment", etc.)
  // =========================================================================
  const isExplicitConfirmation =
    lowerMsg === 'yes' ||
    lowerMsg === 'confirm' ||
    lowerMsg === 'confirm and pay' ||
    lowerMsg === 'yes confirm' ||
    lowerMsg === 'proceed' ||
    lowerMsg === 'proceed to payment' ||
    lowerMsg.includes('yes, confirm') ||
    lowerMsg.includes('confirm order');

  // Guard 0: Day 8 Near-Hallucination Interception (Catches out-of-catalog entities)
  const hallucinationCheck = interceptNearHallucination(sessionId, userMessage);
  if (hallucinationCheck.isHallucination) {
    const step: AgentThoughtStep = {
      stepIndex: 1,
      thought: `Near-hallucination guardrail intercepted query for "${hallucinationCheck.detectedUncataloguedEntity}". Grounding reply with real catalog items.`
    };
    thoughtSteps.push(step);
    return {
      sessionId,
      userMessage,
      assistantReply: `I checked our inventory, but ${hallucinationCheck.groundedCorrection}\n\nWould you like to explore any of these?`,
      thoughtSteps,
      cartSummary: getCartSummary(sessionId)
    };
  }

  // Handle Upsell Acceptance Intent
  if (lowerMsg.includes('add tie') || lowerMsg.includes('add the tie') || lowerMsg.includes('add recommendation') || lowerMsg.includes('add upsell')) {
    const summary = getCartSummary(sessionId);
    const upsell = getUpsellRecommendation(summary);
    if (upsell.eligible && upsell.recommendedProduct && upsell.recommendedVariant) {
      const addRes = addToCart(sessionId, upsell.recommendedProduct.id, upsell.recommendedVariant.id, 1);
      const newSummary = getCartSummary(sessionId);

      const step: AgentThoughtStep = {
        stepIndex: 1,
        thought: `User accepted upsell recommendation. Adding ${upsell.recommendedProduct.name} to cart.`
      };
      step.action = { tool: 'add_to_cart', args: { product_id: upsell.recommendedProduct.id, variant_id: upsell.recommendedVariant.id, quantity: 1 } };
      step.observation = addRes;
      thoughtSteps.push(step);

      return {
        sessionId,
        userMessage,
        assistantReply: `✨ Added **${upsell.recommendedProduct.name}** (${upsell.recommendedVariant.color}) to your cart! 👔\n\nYour updated cart total is **₹${newSummary.pricing.totalInRupees.toFixed(2)}** (${newSummary.totalQuantity} items). Ready to checkout?`,
        thoughtSteps,
        cartSummary: newSummary
      };
    }
  }

  if (isExplicitConfirmation && gate.state === 'REVIEWING_ORDER') {
    // Record human confirmation
    recordExplicitHumanConfirmation(sessionId);

    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: 'User has explicitly confirmed the locked order summary. Gate is unlocked. Calling initiate_payment to create the Razorpay order.'
    };
    step1.action = { tool: 'initiate_payment', args: { customer_name: 'Customer' } };

    const paymentRes = await dispatchToolCall(sessionId, 'initiate_payment', { customer_name: 'Customer' });
    step1.observation = paymentRes.result;
    thoughtSteps.push(step1);

    if (paymentRes.result.success) {
      const order = paymentRes.result.order;
      const rzp = paymentRes.result.razorpayOrder;
      assistantReply = `🎉 **Order #${order.id} Created!**\n\n• **Amount:** ₹${(order.totalInPaise / 100).toFixed(2)}\n• **Razorpay Order ID:** \`${rzp.id}\`\n\nYour payment window is now open. Complete the 2FA/UPI verification to finalize your order!`;
    } else {
      assistantReply = "⚠️ Let's review your order details first before we proceed to payment. Say *'checkout'* to see your locked order review card!";
    }
  }

  // =========================================================================
  // SCENARIO B: REQUEST CHECKOUT / INITIATE PAYMENT FLOW
  // =========================================================================
  else if (
    lowerMsg.includes('checkout') ||
    lowerMsg.includes('pay now') ||
    lowerMsg.includes('buy now') ||
    lowerMsg.includes('initiate payment') ||
    lowerMsg.includes('place order')
  ) {
    const summary = getCartSummary(sessionId);

    if (summary.items.length === 0) {
      assistantReply = "Your cart is empty. Add some items before proceeding to checkout.";
    } else if (!summary.isReadyForCheckout) {
      assistantReply = `⚠️ Cannot checkout yet: ${summary.validationWarnings.join(' ')}`;
    } else {
      const risk = evaluateCartRisk(summary);

      if (risk.isBlocked) {
        assistantReply = `🛑 **Order Safety Limit Reached**\n\n${risk.blockedReason}\n\nPlease adjust your cart items to proceed with conversational checkout.`;
      } else {
        // Step 1: Lock and present summary for review (Human-in-the-Loop Confirmation Gate)
        const step1: AgentThoughtStep = {
          stepIndex: 1,
          thought: `User requested checkout. Risk Level: ${risk.riskLevel} (Score: ${risk.riskScore}/100). Presenting locked order review.`
        };
        step1.action = { tool: 'present_order_summary_for_review', args: {} };
        const reviewRes = await dispatchToolCall(sessionId, 'present_order_summary_for_review', {});
        step1.observation = reviewRes.result;
        thoughtSteps.push(step1);

        const itemsList = summary.items.map(i => `• ${i.quantity}x **${i.productName}** (${i.color ?? ''} ${i.size ?? ''}) — ₹${i.totalPriceInPaise / 100}`).join('\n');

        let advisory = '';
        if (risk.requiresElevatedConfirmation) {
          advisory = `⚠️ **High-Value Order Advisory (Risk Tier: ELEVATED)**\n*This order is above ₹20,000. Please carefully review all line items below.*\n\n`;
        }

        assistantReply = `${advisory}🔒 **Order Confirmation Review**\n\nPlease verify your order before we proceed to payment:\n\n${itemsList}\n\n**Subtotal:** ₹${summary.pricing.subtotalInRupees.toFixed(2)}\n**GST (5%):** ₹${summary.pricing.taxInRupees.toFixed(2)}\n**Shipping:** ${summary.pricing.shippingFeeInRupees === 0 ? 'FREE' : '₹' + summary.pricing.shippingFeeInRupees}\n${summary.pricing.discountInRupees > 0 ? `**Discount (${summary.pricing.couponCode}):** -₹${summary.pricing.discountInRupees.toFixed(2)}\n` : ''}👉 **Total Payable:** **₹${summary.pricing.totalInRupees.toFixed(2)}**\n\n*Reply with **"Confirm"** or click the confirmation button to launch Razorpay checkout.*`;
      }
    }
  }

  // =========================================================================
  // SCENARIO C: VIEW CART SUMMARY
  // =========================================================================
  else if (lowerMsg.includes('cart') && (lowerMsg.includes('show') || lowerMsg.includes('view') || lowerMsg.includes('what is in') || lowerMsg.includes('summary') || lowerMsg === 'cart')) {
    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: 'User is asking to review their current shopping cart. Calling get_cart_summary.'
    };
    step1.action = { tool: 'get_cart_summary', args: {} };
    const observation = await dispatchToolCall(sessionId, 'get_cart_summary', {});
    step1.observation = observation.result;
    thoughtSteps.push(step1);

    const summary = getCartSummary(sessionId);
    if (summary.items.length === 0) {
      assistantReply = "Your cart is currently empty. Tell me what you're looking for (e.g. 'show me formal shirts' or 'linen blazers') and I'll find the best options for you!";
    } else {
      const itemsList = summary.items.map(i => `• ${i.quantity}x **${i.productName}** (${i.color ?? ''} ${i.size ?? ''}) — ₹${i.totalPriceInPaise / 100}`).join('\n');
      assistantReply = `Here is your current cart summary (${summary.totalQuantity} items):\n\n${itemsList}\n\n**Subtotal:** ₹${summary.pricing.subtotalInRupees.toFixed(2)}\n**GST (5%):** ₹${summary.pricing.taxInRupees.toFixed(2)}\n**Shipping:** ${summary.pricing.shippingFeeInRupees === 0 ? 'FREE' : '₹' + summary.pricing.shippingFeeInRupees}\n${summary.pricing.discountInRupees > 0 ? `**Discount:** -₹${summary.pricing.discountInRupees.toFixed(2)}\n` : ''}**Total Payable:** ₹${summary.pricing.totalInRupees.toFixed(2)}`;
    }
  }

  // =========================================================================
  // SCENARIO D: ADD ITEM TO CART
  // =========================================================================
  else if (lowerMsg.includes('add') || lowerMsg.includes('buy') || lowerMsg.includes('put in cart')) {
    let searchKeyword = '';
    let targetSize = '';
    let targetColor = '';
    let quantity = 1;

    if (lowerMsg.includes('two') || lowerMsg.includes(' 2 ') || lowerMsg.startsWith('2 ') || lowerMsg.endsWith(' 2')) quantity = 2;
    if (lowerMsg.includes('three') || lowerMsg.includes(' 3 ')) quantity = 3;

    if (lowerMsg.includes('blue')) targetColor = 'blue';
    else if (lowerMsg.includes('white')) targetColor = 'white';
    else if (lowerMsg.includes('black')) targetColor = 'black';
    else if (lowerMsg.includes('navy')) targetColor = 'navy';
    else if (lowerMsg.includes('burgundy')) targetColor = 'burgundy';
    else if (lowerMsg.includes('tan') || lowerMsg.includes('cognac')) targetColor = 'tan';

    if (lowerMsg.includes('size l') || lowerMsg.includes('in l') || lowerMsg.includes('large')) targetSize = 'L';
    else if (lowerMsg.includes('size m') || lowerMsg.includes('in m') || lowerMsg.includes('medium')) targetSize = 'M';
    else if (lowerMsg.includes('size s') || lowerMsg.includes('in s') || lowerMsg.includes('small')) targetSize = 'S';
    else if (lowerMsg.includes('40')) targetSize = '40';
    else if (lowerMsg.includes('32')) targetSize = '32';
    else if (lowerMsg.includes('uk 8') || lowerMsg.includes('size 8')) targetSize = 'UK 8';
    else if (lowerMsg.includes('uk 9') || lowerMsg.includes('size 9')) targetSize = 'UK 9';

    if (lowerMsg.includes('shirt')) searchKeyword = 'shirt';
    else if (lowerMsg.includes('blazer') || lowerMsg.includes('suit')) searchKeyword = 'blazer';
    else if (lowerMsg.includes('tie')) searchKeyword = 'tie';
    else if (lowerMsg.includes('chinos') || lowerMsg.includes('pants')) searchKeyword = 'chinos';
    else if (lowerMsg.includes('boots') || lowerMsg.includes('shoes')) searchKeyword = 'boots';
    else if (lowerMsg.includes('tee') || lowerMsg.includes('tshirt')) searchKeyword = 'tee';
    else if (lowerMsg.includes('belt')) searchKeyword = 'belt';
    else if (lowerMsg.includes('watch')) searchKeyword = 'watch';
    else if (lowerMsg.includes('bag') || lowerMsg.includes('duffle')) searchKeyword = 'duffle';
    else if (lowerMsg.includes('sweater')) searchKeyword = 'sweater';
    else if (targetColor) searchKeyword = targetColor;

    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `Searching catalog for item matching: "${searchKeyword || 'product'}", color: "${targetColor || 'any'}", size: "${targetSize || 'any'}".`
    };
    step1.action = { tool: 'search_catalog', args: { query: searchKeyword || 'shirt' } };
    const searchRes = await dispatchToolCall(sessionId, 'search_catalog', { query: searchKeyword || 'shirt' });
    step1.observation = searchRes.result;
    thoughtSteps.push(step1);

    const foundProducts = searchRes.result.products || [];
    if (foundProducts.length === 0) {
      assistantReply = `I searched our catalog for "${searchKeyword || userMessage}", but couldn't find any matching items in stock.`;
    } else {
      const selectedProduct = foundProducts[0];
      let selectedVariant = selectedProduct.variants.find((v: any) => {
        const matchesColor = !targetColor || (v.color && v.color.toLowerCase().includes(targetColor));
        const matchesSize = !targetSize || (v.size && v.size.toLowerCase().includes(targetSize.toLowerCase()));
        return matchesColor && matchesSize;
      }) || selectedProduct.variants[0];

      if (selectedVariant) {
        const step2: AgentThoughtStep = {
          stepIndex: 2,
          thought: `Adding ${quantity}x "${selectedProduct.name}" (${selectedVariant.color ?? ''} ${selectedVariant.size ?? ''}) to cart.`
        };
        step2.action = {
          tool: 'add_to_cart',
          args: { product_id: selectedProduct.id, variant_id: selectedVariant.id, quantity }
        };

        const addRes = await dispatchToolCall(sessionId, 'add_to_cart', {
          product_id: selectedProduct.id,
          variant_id: selectedVariant.id,
          quantity
        });
        step2.observation = addRes.result;
        thoughtSteps.push(step2);

        if (addRes.result.success) {
          const currentSummary = getCartSummary(sessionId);
          const upsell = getUpsellRecommendation(currentSummary);
          let upsellPitchText = '';
          if (upsell.eligible && upsell.pitchMessage) {
            upsellPitchText = `\n\n${upsell.pitchMessage}\n*(Reply with 'add the ${upsell.recommendedProduct?.name.toLowerCase().includes('tie') ? 'tie' : 'recommendation'}' to include it!)*`;
          }

          assistantReply = `Added **${quantity}x ${selectedProduct.name}** (${selectedVariant.color ?? ''} ${selectedVariant.size ?? ''}) to your cart! 🛍️${upsellPitchText}\n\nYour cart total is **₹${currentSummary.pricing.totalInRupees.toFixed(2)}** (${currentSummary.totalQuantity} items). Ready to checkout?`;
        } else {
          assistantReply = `⚠️ I couldn't add that item: ${addRes.result.message}`;
        }
      }
    }
  }

  // =========================================================================
  // SCENARIO E: REMOVE ITEM FROM CART
  // =========================================================================
  else if (lowerMsg.includes('remove') || lowerMsg.includes('delete')) {
    const summary = getCartSummary(sessionId);
    if (summary.items.length === 0) {
      assistantReply = "Your cart is already empty.";
    } else {
      const itemToRemove = summary.items.find(i =>
        lowerMsg.includes(i.productName.toLowerCase()) ||
        lowerMsg.includes((i.color || '').toLowerCase()) ||
        lowerMsg.includes((i.size || '').toLowerCase())
      ) || summary.items[0];

      const step1: AgentThoughtStep = {
        stepIndex: 1,
        thought: `User requested to remove "${itemToRemove.productName}" from cart.`
      };
      step1.action = {
        tool: 'remove_from_cart',
        args: { product_id: itemToRemove.productId, variant_id: itemToRemove.variantId }
      };

      const removeRes = await dispatchToolCall(sessionId, 'remove_from_cart', {
        product_id: itemToRemove.productId,
        variant_id: itemToRemove.variantId
      });
      step1.observation = removeRes.result;
      thoughtSteps.push(step1);

      const updated = getCartSummary(sessionId);
      assistantReply = `Removed **${itemToRemove.productName}** from your cart. Your updated total is **₹${updated.pricing.totalInRupees.toFixed(2)}** (${updated.totalQuantity} items).`;
    }
  }

  // =========================================================================
  // SCENARIO F: APPLY COUPON
  // =========================================================================
  else if (lowerMsg.includes('coupon') || lowerMsg.includes('discount') || lowerMsg.includes('welcome10') || lowerMsg.includes('flat500')) {
    const couponCode = lowerMsg.includes('flat500') ? 'FLAT500' : 'WELCOME10';

    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `Applying coupon "${couponCode}".`
    };
    step1.action = { tool: 'apply_coupon', args: { coupon_code: couponCode } };
    const couponRes = await dispatchToolCall(sessionId, 'apply_coupon', { coupon_code: couponCode });
    step1.observation = couponRes.result;
    thoughtSteps.push(step1);

    if (couponRes.result.success) {
      const summary = getCartSummary(sessionId);
      assistantReply = `🎉 Coupon **${couponCode}** applied! You saved **₹${summary.pricing.discountInRupees.toFixed(2)}**. New total: **₹${summary.pricing.totalInRupees.toFixed(2)}**.`;
    } else {
      assistantReply = `⚠️ Could not apply coupon: ${couponRes.result.message}`;
    }
  }

  // =========================================================================
  // SCENARIO G: CATALOG SEARCH / RECOMMENDATIONS
  // =========================================================================
  else {
    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `Searching catalog for recommendations matching "${userMessage}".`
    };
    step1.action = { tool: 'search_catalog', args: { query: userMessage } };
    const searchRes = await dispatchToolCall(sessionId, 'search_catalog', { query: userMessage });
    step1.observation = searchRes.result;
    thoughtSteps.push(step1);

    const items = searchRes.result.products?.slice(0, 3) || [];
    if (items.length > 0) {
      const suggestions = items.map((p: any) => `• **${p.name}** by *${p.brand}* (₹${p.variants[0]?.priceInRupees || ''})`).join('\n');
      assistantReply = `Here are options matching your search:\n\n${suggestions}\n\nSay *"add the blue one in size L"* or *"checkout"* whenever you're ready!`;
    } else {
      assistantReply = "I am your AI Shopping Assistant. Tell me what you'd like to find (e.g. *'show me linen blazers'*, *'add 2 blue shirts'*, or *'checkout'*).";
    }
  }

  // Enforce Max ReAct Steps Cap
  if (thoughtSteps.length > MAX_REACT_STEPS) {
    thoughtSteps.splice(MAX_REACT_STEPS);
  }

  session.history.push({ role: 'assistant', content: assistantReply });

  return {
    sessionId,
    turnIndex: session.turnIndex,
    userMessage,
    assistantReply,
    thoughtProcess: thoughtSteps,
    cartSummary: getCartSummary(sessionId)
  };
}
