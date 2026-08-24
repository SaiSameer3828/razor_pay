# 📅 10-Day Master Execution Plan

> **Objective**: Build a production-grade, explainable, safe, and trustworthy Conversational AI Shopping & Checkout Assistant with Razorpay integration.

---

### **Day 1 — Foundations + Catalog + Cart Logic** *(Current)*
- [x] Set up repository, TypeScript environment, and database schema.
- [x] Build catalog database with 8–10 realistic, rich products with variants (size, color, stock, price, SKU).
- [x] Implement pure cart business logic (`add_to_cart`, `remove_from_cart`, `update_quantity`, `get_cart_summary`).
- [x] 100% test coverage with automated unit tests for all cart operations and edge cases.
- **Checkpoint**: Functions can be called directly with 100% deterministic correctness.

---

### **Day 2 — Razorpay Test Mode (Isolated)**
- Get test API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
- Implement isolated order creation + client-side Checkout.js integration with documented test cards & UPI.
- Complete one full end-to-end fake payment cycle.
- **Checkpoint**: Money (fake test mode) moves end-to-end reliably.

---

### **Day 3 — Wire Cart to Razorpay + Webhook Verification**
- Connect `get_cart_summary()` to backend Razorpay order creation.
- Implement server-side HMAC-SHA256 signature verification & Webhook listener (`payment.captured`, `payment.failed`).
- **Checkpoint**: Hardcoded test cart is checked out and verified server-side.

---

### **Day 4 — Tool Schema + ReAct Loop Skeleton**
- Formalize cart & payment functions as typed LLM tool schemas (JSON Schema).
- Implement conversational agent loop with safe non-monetary tools first (`search_catalog`, `add_to_cart`, `get_cart_summary`).
- **Checkpoint**: Chat naturally ("add two of the navy shirt in size L") and verify state changes.

---

### **Day 5 — Payment Tool + Hard Confirmation Gate**
- Implement `initiate_payment` tool with a hard state machine gate.
- Gate requires previous turn to be an explicit order summary + explicit user confirmation flag.
- **Checkpoint**: Agent strictly refuses to initiate payment without confirmation, even against prompt injection.

---

### **Day 6 — Audit Logging + Live Reasoning Panel**
- Implement structured audit trail recording `(timestamp, intent, tool, input_args, result, reasoning_trace)`.
- Build real-time streaming UI panel showing `Thought → Action → Observation` in real-time.
- **Checkpoint**: Live reasoning stream visible on screen during conversation.

---

### **Day 7 — Bounds, Safety & Risk Scoring**
- Implement hard limits (max order value, catalog-only constraints, max item quantities).
- Implement anomaly & risk scoring engine that triggers higher-tier confirmation on suspicious cart patterns.
- **Checkpoint**: Absurd or invalid orders are blocked and explained gracefully.

---

### **Day 8 — Failure Modes & Recovery**
- Implement Razorpay test-mode decline simulation & graceful recovery without losing cart state.
- Implement "Near-hallucination" interception (detect when user asks for out-of-catalog items).
- **Checkpoint**: Resilient recovery and plain-language explanation of issues.

---

### **Day 9 — Upsell Engine + Structured Agent-Consumable Order Object**
- Implement lightweight, non-naggy complementary product suggestions.
- Finalize schema for an AI-agent consumable order payload.
- **Checkpoint**: Natural conversational flow with intelligent suggestions.

---

### **Day 10 — Demo Rehearsal & Final Polish**
- End-to-end scripted demo walkthrough.
- Time and optimize reasoning narration.
- UI styling and polish.
