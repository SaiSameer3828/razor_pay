import { searchProducts, getProductById, getVariantById } from '../catalog/products.js';
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  getCartSummary,
  applyCoupon
} from '../cart/cartManager.js';
import { ToolResult } from './types.js';

/**
 * Dispatches and executes an agent tool call against pure backend services
 */
export function dispatchToolCall(cartId: string, toolName: string, args: Record<string, any>, callId: string = 'call_default'): ToolResult {
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
        const result = applyCoupon(cartId, args.coupon_code || '');
        return {
          toolCallId: callId,
          name: toolName,
          isError: !result.success,
          result
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
