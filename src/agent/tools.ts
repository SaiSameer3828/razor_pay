import { AgentToolDefinition } from './types.js';

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'search_catalog',
    description: 'Searches the store catalog by natural language keywords, category, color, material, or maximum budget in Rupees.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms such as "blue shirt", "linen blazer", "leather boots", or "formal".'
        },
        category: {
          type: 'string',
          description: 'Optional category filter.',
          enum: ['apparel', 'footwear', 'accessories', 'grooming']
        },
        max_price_in_rupees: {
          type: 'number',
          description: 'Optional maximum price ceiling in Rupees (e.g. 2500).'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_product_details',
    description: 'Retrieves full details for a specific product by its ID, including all color/size variants and live stock count.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The unique product ID (e.g. "prod_oxford_shirt").'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'add_to_cart',
    description: 'Adds a specific product variant and quantity to the user shopping cart. Validates available inventory automatically.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The unique product ID (e.g. "prod_oxford_shirt").'
        },
        variant_id: {
          type: 'string',
          description: 'The specific variant ID matching the user selected color and size (e.g. "var_ox_blu_l").'
        },
        quantity: {
          type: 'number',
          description: 'Number of units to add (default is 1).'
        }
      },
      required: ['product_id', 'variant_id']
    }
  },
  {
    name: 'update_cart_quantity',
    description: 'Updates the quantity of an existing item in the shopping cart. Setting quantity to 0 removes the item.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID in cart.'
        },
        variant_id: {
          type: 'string',
          description: 'The variant ID in cart.'
        },
        quantity: {
          type: 'number',
          description: 'New desired quantity (e.g. 1, 2, 3, or 0 to remove).'
        }
      },
      required: ['product_id', 'variant_id', 'quantity']
    }
  },
  {
    name: 'remove_from_cart',
    description: 'Removes an item variant entirely from the user shopping cart.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to remove.'
        },
        variant_id: {
          type: 'string',
          description: 'The variant ID to remove.'
        }
      },
      required: ['product_id', 'variant_id']
    }
  },
  {
    name: 'get_cart_summary',
    description: 'Retrieves the user current shopping cart summary, including all line items, subtotal, GST tax, shipping, applied discounts, and final total.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'apply_coupon',
    description: 'Applies a promotional discount coupon code (e.g. "WELCOME10", "FLAT500") to the user cart.',
    parameters: {
      type: 'object',
      properties: {
        coupon_code: {
          type: 'string',
          description: 'The coupon code to apply (e.g. "WELCOME10").'
        }
      },
      required: ['coupon_code']
    }
  },
  {
    name: 'present_order_summary_for_review',
    description: 'Presents an explicit, locked order review card showing exact items, taxes, shipping, discounts, and final total for human verification before payment can be authorized.',
    parameters: {
      type: 'object',
      properties: {
        customer_notes: {
          type: 'string',
          description: 'Optional customer instructions or notes for the order.'
        }
      }
    }
  },
  {
    name: 'initiate_payment',
    description: 'Gated payment tool that generates a Razorpay Order ID and returns client checkout tokens. Strictly fails if explicit human confirmation was not recorded in the prior step.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Customer name for billing receipt.'
        },
        customer_email: {
          type: 'string',
          description: 'Customer email address for invoice and payment receipt.'
        },
        customer_phone: {
          type: 'string',
          description: 'Customer phone number.'
        }
      }
    }
  }
];

export const SAFE_TOOLS = AGENT_TOOLS.filter(t => t.name !== 'initiate_payment');
