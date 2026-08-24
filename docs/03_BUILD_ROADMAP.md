# 🗺️ Implementation Roadmap & Milestones

This phased roadmap outlines the complete development cycle from project bootstrapping to production readiness.

```mermaid
gantt
    title Conversational Shopping Assistant Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation & Catalog
    Database & Mock Store Setup       :p1_1, 2026-08-25, 3d
    Backend API Architecture          :p1_2, after p1_1, 3d
    section Phase 2: Agent & Tooling
    Agent Function Calling System     :p2_1, after p1_2, 4d
    Contextual Recommendations Engine :p2_2, after p2_1, 3d
    Audit Trail & Reasoning Logs      :p2_3, after p2_2, 2d
    section Phase 3: Razorpay Integration
    Order Creation API & SDK          :p3_1, after p2_3, 3d
    Webhook & Signature Verification  :p3_2, after p3_1, 3d
    Dispute & Failure Handlers        :p3_3, after p3_2, 2d
    section Phase 4: Frontend Experience
    Interactive Chat UI & Cart Widget :p4_1, after p3_3, 4d
    Razorpay Modal & Status Sync      :p4_2, after p4_1, 2d
    section Phase 5: Testing & Release
    End-to-End Test Suite            :p5_1, after p4_2, 3d
    Performance & Security Audit      :p5_2, after p5_1, 2d
```

---

## 🎯 Phase 1: Foundation, Catalog & Core API
- [ ] Initialize project stack (Node.js / Express or Fastify / TypeScript backend, React/Vite or Next.js frontend).
- [ ] Implement Product Catalog Schema:
  - Product metadata: `id`, `name`, `description`, `category`, `price`, `currency`, `tags`, `image_url`.
  - Variants: `variant_id`, `size`, `color`, `stock_quantity`, `sku`.
- [ ] Build search & filtering engine (keyword search + semantic vector embeddings for natural queries like "something warm for winter").
- [ ] Build Cart Management Service (Deterministic calculations: subtotal, taxes, shipping, coupon validation).

---

## 🧠 Phase 2: Agent Core, Function Calling & Guardrails
- [ ] Configure Agent Orchestrator with structured tools:
  - `search_catalog(query, filters, price_max)`
  - `get_product_details(product_id)`
  - `manage_cart(action: 'add'|'remove'|'update', variant_id, quantity)`
  - `get_cart_summary()`
  - `suggest_complementary_items(cart_items, max_budget)`
  - `request_checkout_confirmation(cart_id)`
- [ ] Implement Guardrails & Explanations:
  - Pre-execution validation for budget constraints.
  - Natural language reasoning logger (exposing "Why I recommended this" to UI).
  - Activity audit log (saving every state mutation into a session ledger).

---

## 💳 Phase 3: Razorpay Payment Gateway & Trust Pipeline
- [ ] Server-side Razorpay SDK setup with test credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
- [ ] Implement secure `create-order` endpoint:
  - Generates Razorpay Order ID linked to cart and user session.
  - Locks inventory temporarily (e.g., 15-minute hold).
- [ ] Implement Webhook receiver & signature verification (`X-Razorpay-Signature` HMAC verification):
  - Handle `payment.captured` -> Confirm order & generate receipt.
  - Handle `payment.failed` -> Notify assistant, unlock stock, offer instant retry.
- [ ] Implement refund & dispute handling utilities.

---

## 🎨 Phase 4: Conversational Frontend & Interactive UI
- [ ] Build chat interface with rich media cards:
  - Product showcase cards with size/color pills.
  - Dynamic Cart Drawer that updates live as the assistant speaks.
  - Live "Reasoning / Thought Process" accordion toggle.
  - Transparent Review & Pay confirmation modal.
- [ ] Integrate Razorpay Standard Checkout SDK (`Razorpay(options).open()`).
- [ ] Implement real-time order status updates (SSE or WebSockets).

---

## 🧪 Phase 5: Security, Testing & Deployment
- [ ] Automated integration tests for edge cases:
  - Out of stock handling.
  - Invalid coupon application.
  - Budget ceiling overflow.
  - Signature forgery rejection.
- [ ] CI/CD pipeline and deployment config (Vercel / AWS / Docker).
