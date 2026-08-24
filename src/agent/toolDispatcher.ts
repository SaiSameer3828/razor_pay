import { searchProducts, getProductById } from '../catalog/products.js';
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  getCartSummary,
  applyCoupon
} from '../cart/cartManager.js';
import { createOrderFromCart } from '../orders/orderManager.js';
import {
  markOrderPresentedForReview,
  invalidateConfirmationOnCartChange,
  evaluatePaymentGate
} from './confirmationGate.js';
import { AGENT_TOOLS } from './tools.js';
import { ToolResult } from './types.js';

/**
 * Validates tool arguments against the declared JSON Schema before execution
 */
function validateToolArguments(toolName: string, args: Record<string, any>): { isValid: boolean; error?: string } {
  const toolDef = AGENT_TOOLS.find(t => t.name === toolName);
  if (!toolDef) {
    return { isValid: false, error: `Tool "${toolName}" is not registered in system schema.` };
  }

  // Check required fields
  const required = toolDef.parameters.required || [];
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === '') {
      return { isValid: false, error: `MISSING_REQUIRED_ARGUMENT: Tool "${toolName}" requires "${field}".` };
    }
  }

  // Check types
  const properties = toolDef.parameters.properties;
  for (const [key, val] of Object.entries(args)) {
    const propSchema = properties[key];
    if (propSchema) {
      if (propSchema.type === 'number' && typeof val !== 'number' && isNaN(Number(val))) {
        return { isValid: false, error: `TYPE_MISMATCH: Argument "${key}" must be a number.` };
      }
      if (propSchema.type === 'string' && typeof val !== 'string') {
        return { isValid: false, error: `TYPE_MISMATCH: Argument "${key}" must be a string.` };
      }
      if (propSchema.enum && !propSchema.enum.includes(val)) {
        return { isValid: false, error: `INVALID_ENUM: Argument "${key}" must be one of: ${propSchema.enum.join(', ')}.` };
      }
    }
  }

  return { isValid: true };
}

/**
 * Dispatches and executes an agent tool call against pure backend services
 */
export async function dispatchToolCall(
  cartId: string,
  toolName: string,
  args: Record<string, any>,
  callId: string = 'call_default'
): Promise<ToolResult> {
  // Step 1: Strict JSON Schema Argument Validation
  const validation = validateToolArguments(toolName, args);
  if (!validation.isValid) {
    return {
      toolCallId: callId,
      name: toolName,
      isError: true,
      result: { error: validation.error }
    };
  }

  try {
    switch (toolName) {
      case 'search_catalog': {
        const query = args.query || '';
        const maxPriceInPaise = args.max_price_in_rupees ? Math.round(args.max_price_in_rupees * 100) : undefined;
        const category = args.category;

        const results = searchProducts(query, { category, maxPriceInPaise });
        const simplified = results.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          rating: p.rating,
          variants: p.variants.map(v => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            size: v.size,
            priceInRupees: v.priceInPaise / 100,
            stock: v.stock
          }))
        }));

        return {
          toolCallId: callId,
          name: toolName,
          result: {
            count: simplified.length,
            products: simplified
          }
        };
      }

      case 'get_product_details': {
        const product = getProductById(args.product_id);
        if (!product) {
          return {
            toolCallId: callId,
            name: toolName,
            isError: true,
            result: { error: `Product with ID "${args.product_id}" not found in catalog.` }
          };
        }

        return {
          toolCallId: callId,
          name: toolName,
          result: {
            ...product,
            variants: product.variants.map(v => ({
              ...v,
              priceInRupees: v.priceInPaise / 100
            }))
          }
        };
      }

      case 'add_to_cart': {
        invalidateConfirmationOnCartChange(cartId); // Any cart mutation invalidates previous review
        const quantity = args.quantity !== undefined ? Number(args.quantity) : 1;
        const result = addToCart(cartId, args.product_id, args.variant_id, quantity);
        return {
          toolCallId: callId,
          name: toolName,
          isError: !result.success,
          result
        };
      }

      case 'update_cart_quantity': {
        invalidateConfirmationOnCartChange(cartId);
        const quantity = Number(args.quantity);
        const result = updateQuantity(cartId, args.product_id, args.variant_id, quantity);
        return {
          toolCallId: callId,
          name: toolName,
          isError: !result.success,
          result
        };
      }

      case 'remove_from_cart': {
        invalidateConfirmationOnCartChange(cartId);
        const result = removeFromCart(cartId, args.product_id, args.variant_id);
        return {
          toolCallId: callId,
          name: toolName,
          isError: !result.success,
          result
        };
      }

      case 'get_cart_summary': {
        const summary = getCartSummary(cartId);
        return {
          toolCallId: callId,
          name: toolName,
          result: summary
        };
      }

      case 'apply_coupon': {
        invalidateConfirmationOnCartChange(cartId);
        const result = applyCoupon(cartId, args.coupon_code || '');
        return {
          toolCallId: callId,
          name: toolName,
          isError: !result.success,
          result
        };
      }

      case 'present_order_summary_for_review': {
        const summary = getCartSummary(cartId);
        if (summary.items.length === 0) {
          return {
            toolCallId: callId,
            name: toolName,
            isError: true,
            result: { error: 'Cannot present order summary: Cart is empty.' }
          };
        }

        markOrderPresentedForReview(cartId, summary);

        return {
          toolCallId: callId,
          name: toolName,
          result: {
            success: true,
            message: 'Order summary locked and presented for human review.',
            confirmationState: 'AWAITING_USER_CONFIRMATION',
            cart: summary
          }
        };
      }

      case 'initiate_payment': {
        const summary = getCartSummary(cartId);

        // EVALUATE HARD CONFIRMATION GATE
        const gateEvaluation = evaluatePaymentGate(cartId, summary);
        if (!gateEvaluation.allowed) {
          return {
            toolCallId: callId,
            name: toolName,
            isError: true,
            result: {
              success: false,
              gateLocked: true,
              error: gateEvaluation.reason
            }
          };
        }

        // Gate Passed: Create Razorpay Order
        const checkoutResult = await createOrderFromCart(cartId, {
          customerDetails: {
            name: args.customer_name || 'Customer',
            email: args.customer_email || 'customer@example.com',
            phone: args.customer_phone || '9999999999'
          }
        });

        return {
          toolCallId: callId,
          name: toolName,
          isError: !checkoutResult.success,
          result: checkoutResult
        };
      }

      default:
        return {
          toolCallId: callId,
          name: toolName,
          isError: true,
          result: { error: `Tool "${toolName}" is not recognized or permitted.` }
        };
    }
  } catch (err) {
    return {
      toolCallId: callId,
      name: toolName,
      isError: true,
      result: { error: `Tool execution failed: ${(err as Error).message}` }
    };
  }
}
