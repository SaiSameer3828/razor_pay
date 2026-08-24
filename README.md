# 🛍️ Conversational AI Shopping & Checkout Assistant (Powered by Razorpay)

> **"Text a smart store assistant, review your curated cart, and pay securely with zero friction and absolute trust."**

---

## 📌 Executive Summary
Traditional e-commerce demands active manual effort: search, filtering, navigating paginated catalogs, configuring sizes/colors, cart management, checkout form-filling, and payment steps.

This project introduces an **agentic, conversational shopping assistant** that turns shopping into a natural dialogue. More importantly, it is engineered around **financial trust and safety** — with explicit confirmation checkpoints, strict catalog grounding, hard spending limits, transparent reasoning trails, and resilient Razorpay payment handling.

---

## 📂 Documentation Directory

| Document | Description |
| :--- | :--- |
| **[01_PROJECT_VISION.md](file:///c:/Users/sai%20sameer/OneDrive/Desktop/razor%20pay/docs/01_PROJECT_VISION.md)** | Core philosophy, user personas, key use cases, and trust principles. |
| **[02_FEASIBILITY_STUDY.md](file:///c:/Users/sai%20sameer/OneDrive/Desktop/razor%20pay/docs/02_FEASIBILITY_STUDY.md)** | Technical, operational, security, and economic feasibility analysis. |
| **[03_BUILD_ROADMAP.md](file:///c:/Users/sai%20sameer/OneDrive/Desktop/razor%20pay/docs/03_BUILD_ROADMAP.md)** | Phased implementation plan from MVP to production readiness. |
| **[04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/sai%20sameer/OneDrive/Desktop/razor%20pay/docs/04_SYSTEM_ARCHITECTURE.md)** | Agent state machine, tool design, database schema, and payment security flow. |

---

## 🚀 Key Highlights & Differentiators

1. **Human-in-the-Loop Financial Guardrail**: The AI *never* self-executes a transaction. Final order confirmation and payment tokenization always require explicit user trigger and Razorpay secure verification.
2. **Deterministic Catalog Grounding**: Function calling with tool schemas strictly validates product IDs, SKU variants, stock, and live prices to eliminate hallucinated products.
3. **Transparent Reasoning & Audit Trail**: Real-time structured thought process and immutable event logs for every cart change and state transition.
4. **Resilient Error Recovery**: Smart handling for card declines, stock-outs, network drops, and conversational ambiguity without breaking session state.
