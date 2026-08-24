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
import { recordAuditLog } from '../audit/auditLogger.js';
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
 * Dispatches and executes an agent tool call against pure backend services, recording each action in audit logs
 */
export async function dispatchToolCall(
  cartId: string,
  toolName: string,
  args: Record<string, any>,
  callId: string = 'call_default'
): Promise<ToolResult> {
  const startTime = Date.now();

  // Step 1: Strict JSON Schema Argument Validation
  const validation = validateToolArguments(toolName, args);
  if (!validation.isValid) {
    const result: ToolResult = {
      toolCallId: callId,
      name: toolName,
      isError: true,
      result: { error: validation.error }
    };

    recordAuditLog({
      sessionId: cartId,
      turnIndex: 0,
      type: 'TOOL_EXECUTION',
      tool: toolName,
      args,
      result: result.result,
      outcome: 'BLOCKED',
      reason: validation.error,
      executionTimeMs: Date.now() - startTime
    });

    return result;
  }

  try {
    let resultPayload: any;
    let isError = false;

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

        resultPayload = {
          count: simplified.length,
          products: simplified
        };
        break;
      }

      case 'get_product_details': {
        const product = getProductById(args.product_id);
        if (!product) {
          isError = true;
          resultPayload = { error: `Product with ID "${args.product_id}" not found in catalog.` };
        } else {
          resultPayload = {
            ...product,
            variants: product.variants.map(v => ({
              ...v,
              priceInRupees: v.priceInPaise / 100
            }))
          };
        }
        break;
      }

      case 'add_to_cart': {
        invalidateConfirmationOnCartChange(cartId);
        const quantity = args.quantity !== undefined ? Number(args.quantity) : 1;
        const addRes = addToCart(cartId, args.product_id, args.variant_id, quantity);
        isError = !addRes.success;
        resultPayload = addRes;
        break;
      }

      case 'update_cart_quantity': {
        invalidateConfirmationOnCartChange(cartId);
        const quantity = Number(args.quantity);
        const updateRes = updateQuantity(cartId, args.product_id, args.variant_id, quantity);
        isError = !updateRes.success;
        resultPayload = updateRes;
        break;
      }

      case 'remove_from_cart': {
        invalidateConfirmationOnCartChange(cartId);
        const removeRes = removeFromCart(cartId, args.product_id, args.variant_id);
        isError = !removeRes.success;
        resultPayload = removeRes;
        break;
      }

      case 'get_cart_summary': {
        resultPayload = getCartSummary(cartId);
        break;
      }

      case 'apply_coupon': {
        invalidateConfirmationOnCartChange(cartId);
        const couponRes = applyCoupon(cartId, args.coupon_code || '');
        isError = !couponRes.success;
        resultPayload = couponRes;
        break;
      }

      case 'present_order_summary_for_review': {
        const summary = getCartSummary(cartId);
        if (summary.items.length === 0) {
          isError = true;
          resultPayload = { error: 'Cannot present order summary: Cart is empty.' };
        } else {
          markOrderPresentedForReview(cartId, summary);
          resultPayload = {
            success: true,
            message: 'Order summary locked and presented for human review.',
            confirmationState: 'AWAITING_USER_CONFIRMATION',
            cart: summary
          };
        }
        break;
      }

      case 'initiate_payment': {
        const summary = getCartSummary(cartId);

        // EVALUATE HARD CONFIRMATION GATE
        const gateEvaluation = evaluatePaymentGate(cartId, summary);
        if (!gateEvaluation.allowed) {
          isError = true;
          resultPayload = {
            success: false,
            gateLocked: true,
            error: gateEvaluation.reason
          };
          break;
        }

        // Gate Passed: Create Razorpay Order using the snapshotted total
        const checkoutResult = await createOrderFromCart(cartId, {
          customerDetails: {
            name: args.customer_name || 'Customer',
            email: args.customer_email || 'customer@example.com',
            phone: args.customer_phone || '9999999999'
          }
        });

        isError = !checkoutResult.success;
        resultPayload = checkoutResult;

        if (checkoutResult.success) {
          recordAuditLog({
            sessionId: cartId,
            turnIndex: 0,
            type: 'PAYMENT_EVENT',
            thought: `Razorpay Order #${checkoutResult.razorpayOrder?.id} created for Internal Order #${checkoutResult.order?.id}. Amount locked: ₹${((checkoutResult.order?.totalInPaise || 0) / 100).toFixed(2)}.`,
            outcome: 'SUCCESS',
            result: {
              orderId: checkoutResult.order?.id,
              razorpayOrderId: checkoutResult.razorpayOrder?.id,
              amount: checkoutResult.order?.totalInPaise
            }
          });
        }
        break;
      }

      default:
        isError = true;
        resultPayload = { error: `Tool "${toolName}" is not recognized or permitted.` };
    }

    const executionTimeMs = Date.now() - startTime;

    recordAuditLog({
      sessionId: cartId,
      turnIndex: 0,
      type: 'TOOL_EXECUTION',
      tool: toolName,
      args,
      result: resultPayload,
      outcome: isError ? 'FAILED' : 'SUCCESS',
      reason: isError ? resultPayload?.error || resultPayload?.message : undefined,
      executionTimeMs
    });

    return {
      toolCallId: callId,
      name: toolName,
      isError,
      result: resultPayload
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = (err as Error).message;

    recordAuditLog({
      sessionId: cartId,
      turnIndex: 0,
      type: 'TOOL_EXECUTION',
      tool: toolName,
      args,
      outcome: 'FAILED',
      reason: errorMsg,
      executionTimeMs
    });

    return {
      toolCallId: callId,
      name: toolName,
      isError: true,
      result: { error: `Tool execution failed: ${errorMsg}` }
    };
  }
}
