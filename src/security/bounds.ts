export const SAFETY_BOUNDS = {
  MAX_QUANTITY_PER_SKU: 5,
  MAX_TOTAL_ITEMS_IN_CART: 15,
  MAX_ORDER_VALUE_IN_PAISE: 5000000, // ₹50,000 maximum conversational checkout ceiling
  MAX_ORDER_VALUE_IN_RUPEES: 50000,
  HIGH_VALUE_THRESHOLD_IN_PAISE: 2000000 // ₹20,000 triggers elevated confirmation tier
};
