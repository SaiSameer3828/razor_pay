# 🏗️ System Architecture & State Machine

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    User([User in Chat UI]) <--> |Natural Language + Interactive Cards| Frontend[Web App / Client]
    
    subgraph "Application Core"
        Frontend <--> |WebSocket / REST API| Backend[Node.js / Express Server]
        Backend <--> Agent[LLM Agent Orchestrator]
        
        Agent --> |Tool Execution| CatalogService[Catalog & Inventory Service]
        Agent --> |Tool Execution| CartService[Cart & Pricing Service]
        Agent --> |Audit Logs| AuditLedger[(Audit & Reasoning Log)]
    end
    
    subgraph "Database & Storage"
        CatalogService --> DB[(Products & Inventory DB)]
        CartService --> SessionStore[(User Session / Cart DB)]
    end
    
    subgraph "Payment Trust Layer (Razorpay)"
        Backend --> |1. Create Order| RazorpayAPI[Razorpay API]
        Frontend --> |2. Launch Secure Checkout Modal| RazorpayCheckout[Razorpay Checkout SDK]
        RazorpayCheckout --> |3. Complete 2FA / Payment| RazorpayAPI
        RazorpayAPI --> |4. Webhook: payment.captured| Backend
    end
```

---

## 2. Conversational State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle_Greeting: User opens chat
    Idle_Greeting --> Intent_Discovery: User sends prompt
    
    Intent_Discovery --> Product_Search: User describes item
    Product_Search --> Item_Suggestion: Products found & filtered
    
    Item_Suggestion --> Cart_Building: User confirms selection
    Cart_Building --> Complementary_Recommendation: Agent suggests match
    
    Complementary_Recommendation --> Cart_Building: User accepts suggestion
    Complementary_Recommendation --> Review_Summary: User ready to pay
    Cart_Building --> Review_Summary: User says "checkout"
    
    Review_Summary --> Payment_Initiated: User clicks "Confirm & Pay"
    Payment_Initiated --> Payment_Success: Razorpay signature verified
    Payment_Initiated --> Payment_Failed: User cancels or bank declines
    
    Payment_Failed --> Review_Summary: Agent recovers & offers alternative
    Payment_Success --> [*]: Receipt & tracking displayed
```

---

## 3. Tool Specifications for LLM Agent

The LLM agent interacts with the backend strictly through typed function declarations:

### 1. `search_products`
```json
{
  "name": "search_products",
  "description": "Searches the store catalog by query, category, color, or price range.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "category": { "type": "string" },
      "max_price": { "type": "number" },
      "color": { "type": "string" }
    },
    "required": ["query"]
  }
}
```

### 2. `modify_cart`
```json
{
  "name": "modify_cart",
  "description": "Adds, updates quantity, or removes items from the active user cart.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": { "type": "string", "enum": ["add", "remove", "update"] },
      "product_id": { "type": "string" },
      "variant_id": { "type": "string" },
      "quantity": { "type": "integer" }
    },
    "required": ["action", "product_id"]
  }
}
```

### 3. `request_checkout_review`
```json
{
  "name": "request_checkout_review",
  "description": "Renders an explicit, locked order review card for user approval before generating a payment order.",
  "parameters": {
    "type": "object",
    "properties": {
      "customer_notes": { "type": "string" }
    }
  }
}
```

---

## 4. Payment Security & Integrity Flow
1. **Server-Side Price Calculation**: When the user requests checkout, the backend retrieves product prices directly from the database to compute `order_total = sum(item.price * item.quantity) + tax - discount`. The LLM has **no ability to modify the final numeric charge**.
2. **Order Integrity**: A Razorpay Order is generated with `amount = order_total_in_paise` and linked to `order_id` in our database.
3. **HMAC Signature Verification**:
   ```javascript
   const crypto = require('crypto');
   const generated_signature = crypto
     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
     .update(razorpay_order_id + "|" + razorpay_payment_id)
     .digest('hex');

   if (generated_signature === razorpay_signature) {
     // Payment is authentic and verified
   }
   ```
