import { SAFE_TOOLS } from './tools.js';
import { dispatchToolCall } from './toolDispatcher.js';
import { AgentResponse, AgentThoughtStep, ToolCall } from './types.js';
import { getCartSummary } from '../cart/cartManager.js';
import { searchProducts, CATALOG } from '../catalog/products.js';

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
 * ReAct Agent Orchestrator:
 * Executes the Thought -> Action -> Observation loop driven by natural language.
 */
export async function runAgentTurn(sessionId: string, userMessage: string): Promise<AgentResponse> {
  const session = getOrCreateSession(sessionId);
  session.turnIndex += 1;
  session.history.push({ role: 'user', content: userMessage });

  const thoughtSteps: AgentThoughtStep[] = [];
  let assistantReply = '';

  const lowerMsg = userMessage.toLowerCase().trim();

  // =========================================================================
  // Deterministic ReAct Strategy Engine (Fast, testable, anti-hallucinatory)
  // =========================================================================

  // SCENARIO 1: View / Show Cart Summary
  if (lowerMsg.includes('cart') && (lowerMsg.includes('show') || lowerMsg.includes('view') || lowerMsg.includes('what is in') || lowerMsg.includes('summary') || lowerMsg === 'cart')) {
    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: 'User is asking to review their current shopping cart. Let me call get_cart_summary to retrieve all line items, tax, and total.'
    };

    const action = { tool: 'get_cart_summary', args: {} };
    step1.action = action;
    const observation = dispatchToolCall(sessionId, 'get_cart_summary', {});
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

  // SCENARIO 2: Add item to cart ("add two of the blue one", "add shirt size L", etc.)
  else if (lowerMsg.includes('add') || lowerMsg.includes('buy') || lowerMsg.includes('put in cart')) {
    // Step 1: Detect query keywords & size/color constraints
    let searchKeyword = '';
    let targetSize = '';
    let targetColor = '';
    let quantity = 1;

    // Detect quantity (e.g., "two", "2", "3", "three")
    if (lowerMsg.includes('two') || lowerMsg.includes(' 2 ') || lowerMsg.startsWith('2 ') || lowerMsg.endsWith(' 2')) quantity = 2;
    if (lowerMsg.includes('three') || lowerMsg.includes(' 3 ')) quantity = 3;

    // Detect color
    if (lowerMsg.includes('blue')) targetColor = 'blue';
    else if (lowerMsg.includes('white')) targetColor = 'white';
    else if (lowerMsg.includes('black')) targetColor = 'black';
    else if (lowerMsg.includes('navy')) targetColor = 'navy';
    else if (lowerMsg.includes('burgundy')) targetColor = 'burgundy';
    else if (lowerMsg.includes('tan') || lowerMsg.includes('cognac')) targetColor = 'tan';

    // Detect size
    if (lowerMsg.includes('size l') || lowerMsg.includes('in l') || lowerMsg.includes('large')) targetSize = 'L';
    else if (lowerMsg.includes('size m') || lowerMsg.includes('in m') || lowerMsg.includes('medium')) targetSize = 'M';
    else if (lowerMsg.includes('size s') || lowerMsg.includes('in s') || lowerMsg.includes('small')) targetSize = 'S';
    else if (lowerMsg.includes('40')) targetSize = '40';
    else if (lowerMsg.includes('32')) targetSize = '32';
    else if (lowerMsg.includes('uk 8') || lowerMsg.includes('size 8')) targetSize = 'UK 8';
    else if (lowerMsg.includes('uk 9') || lowerMsg.includes('size 9')) targetSize = 'UK 9';

    // Detect product type
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

    // Action 1: Search Catalog
    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `User wants to add item(s) to cart with intent: "${searchKeyword || 'product'}", color: "${targetColor || 'any'}", size: "${targetSize || 'any'}", quantity: ${quantity}. Let me search the store catalog to find the exact matching product and in-stock variant.`
    };
    step1.action = { tool: 'search_catalog', args: { query: searchKeyword || 'shirt' } };
    const searchRes = dispatchToolCall(sessionId, 'search_catalog', { query: searchKeyword || 'shirt' });
    step1.observation = searchRes.result;
    thoughtSteps.push(step1);

    const foundProducts = searchRes.result.products || [];
    if (foundProducts.length === 0) {
      assistantReply = `I searched our catalog for "${searchKeyword || userMessage}", but couldn't find any matching items in stock. Would you like to check our shirts, blazers, chinos, or footwear instead?`;
    } else {
      const selectedProduct = foundProducts[0];
      // Find matching variant
      let selectedVariant = selectedProduct.variants.find((v: any) => {
        const matchesColor = !targetColor || (v.color && v.color.toLowerCase().includes(targetColor));
        const matchesSize = !targetSize || (v.size && v.size.toLowerCase().includes(targetSize.toLowerCase()));
        return matchesColor && matchesSize;
      });

      if (!selectedVariant && selectedProduct.variants.length > 0) {
        // Fallback to first variant if size/color was not specified
        selectedVariant = selectedProduct.variants[0];
      }

      if (selectedVariant) {
        // Action 2: Add to cart
        const step2: AgentThoughtStep = {
          stepIndex: 2,
          thought: `Found "${selectedProduct.name}" variant "${selectedVariant.sku}" (${selectedVariant.color ?? ''} ${selectedVariant.size ?? ''}) at ₹${selectedVariant.priceInRupees}. Calling add_to_cart for ${quantity} unit(s).`
        };
        step2.action = {
          tool: 'add_to_cart',
          args: {
            product_id: selectedProduct.id,
            variant_id: selectedVariant.id,
            quantity
          }
        };

        const addRes = dispatchToolCall(sessionId, 'add_to_cart', {
          product_id: selectedProduct.id,
          variant_id: selectedVariant.id,
          quantity
        });
        step2.observation = addRes.result;
        thoughtSteps.push(step2);

        if (addRes.result.success) {
          const currentSummary = getCartSummary(sessionId);
          assistantReply = `Added **${quantity}x ${selectedProduct.name}** (${selectedVariant.color ?? ''} ${selectedVariant.size ?? ''}) to your cart! 🛍️\n\nYour cart now has **${currentSummary.totalQuantity} items** with a total of **₹${currentSummary.pricing.totalInRupees.toFixed(2)}** (includes 5% GST & free shipping). Would you like to add anything else or review the cart?`;
        } else {
          assistantReply = `⚠️ I couldn't add that item: ${addRes.result.message}`;
        }
      }
    }
  }

  // SCENARIO 3: Remove item from cart
  else if (lowerMsg.includes('remove') || lowerMsg.includes('delete')) {
    const summary = getCartSummary(sessionId);
    if (summary.items.length === 0) {
      assistantReply = "Your cart is already empty.";
    } else {
      // Find item to remove
      const itemToRemove = summary.items.find(i =>
        lowerMsg.includes(i.productName.toLowerCase()) ||
        lowerMsg.includes((i.color || '').toLowerCase()) ||
        lowerMsg.includes((i.size || '').toLowerCase())
      ) || summary.items[0]; // default remove first if unspecified

      const step1: AgentThoughtStep = {
        stepIndex: 1,
        thought: `User requested to remove "${itemToRemove.productName}" from their cart. Calling remove_from_cart.`
      };
      step1.action = {
        tool: 'remove_from_cart',
        args: { product_id: itemToRemove.productId, variant_id: itemToRemove.variantId }
      };

      const removeRes = dispatchToolCall(sessionId, 'remove_from_cart', {
        product_id: itemToRemove.productId,
        variant_id: itemToRemove.variantId
      });
      step1.observation = removeRes.result;
      thoughtSteps.push(step1);

      const updated = getCartSummary(sessionId);
      assistantReply = `Removed **${itemToRemove.productName}** from your cart. Your updated total is **₹${updated.pricing.totalInRupees.toFixed(2)}** (${updated.totalQuantity} items).`;
    }
  }

  // SCENARIO 4: Apply Coupon
  else if (lowerMsg.includes('coupon') || lowerMsg.includes('discount') || lowerMsg.includes('welcome10') || lowerMsg.includes('flat500')) {
    const couponCode = lowerMsg.includes('flat500') ? 'FLAT500' : 'WELCOME10';

    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `User wants to apply discount code "${couponCode}". Calling apply_coupon tool.`
    };
    step1.action = { tool: 'apply_coupon', args: { coupon_code: couponCode } };
    const couponRes = dispatchToolCall(sessionId, 'apply_coupon', { coupon_code: couponCode });
    step1.observation = couponRes.result;
    thoughtSteps.push(step1);

    if (couponRes.result.success) {
      const summary = getCartSummary(sessionId);
      assistantReply = `🎉 Coupon **${couponCode}** applied successfully! You saved **₹${summary.pricing.discountInRupees.toFixed(2)}**. New total payable: **₹${summary.pricing.totalInRupees.toFixed(2)}**.`;
    } else {
      assistantReply = `⚠️ Could not apply coupon: ${couponRes.result.message}`;
    }
  }

  // SCENARIO 5: Catalog Search / Browse
  else {
    const step1: AgentThoughtStep = {
      stepIndex: 1,
      thought: `User is asking about products or recommendations ("${userMessage}"). Searching catalog to find relevant in-stock recommendations.`
    };
    step1.action = { tool: 'search_catalog', args: { query: userMessage } };
    const searchRes = dispatchToolCall(sessionId, 'search_catalog', { query: userMessage });
    step1.observation = searchRes.result;
    thoughtSteps.push(step1);

    const items = searchRes.result.products?.slice(0, 3) || [];
    if (items.length > 0) {
      const suggestions = items.map((p: any) => `• **${p.name}** by *${p.brand}* (₹${p.variants[0]?.priceInRupees || ''}) — ${p.variants.map((v: any) => v.color).filter(Boolean).slice(0, 2).join(', ')}`).join('\n');
      assistantReply = `Here are some great options matching your request:\n\n${suggestions}\n\nJust say something like *"add the blue one in size L"* and I'll prepare it for you!`;
    } else {
      assistantReply = "Hello! I am your AI Shopping Assistant. You can tell me what you're looking for in plain language, such as:\n\n• *\"Show me linen blazers for a wedding\"*\n• *\"Add two Oxford shirts in blue size L\"*\n• *\"What is in my cart?\"*\n• *\"Apply coupon WELCOME10\"*";
    }
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
