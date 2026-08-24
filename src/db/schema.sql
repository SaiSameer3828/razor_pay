-- ==========================================================
-- 🛒 POSTGRESQL SCHEMA: E-COMMERCE & CONVERSATIONAL CHECKOUT
-- ==========================================================

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    gender VARCHAR(32),
    brand VARCHAR(128) NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    featured_image TEXT NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS product_variants (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(128) NOT NULL UNIQUE,
    size VARCHAR(64),
    color VARCHAR(64),
    material VARCHAR(64),
    price_in_paise INTEGER NOT NULL,
    original_price_in_paise INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. USER SESSIONS / CARTS TABLE
CREATE TABLE IF NOT EXISTS carts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    coupon_code VARCHAR(64),
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'locked_for_checkout', 'converted_to_order', 'abandoned'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. CART ITEMS TABLE
CREATE TABLE IF NOT EXISTS cart_items (
    id VARCHAR(64) PRIMARY KEY,
    cart_id VARCHAR(64) NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    variant_id VARCHAR(64) NOT NULL REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_in_paise INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, variant_id)
);

-- 5. ORDERS TABLE (Razorpay Linked)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY, -- Internal order ID (e.g. ord_xxx)
    cart_id VARCHAR(64) REFERENCES carts(id),
    user_id VARCHAR(64),
    razorpay_order_id VARCHAR(128) UNIQUE,
    razorpay_payment_id VARCHAR(128),
    razorpay_signature VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'created', -- 'created', 'authorized', 'captured', 'failed', 'refunded'
    subtotal_in_paise INTEGER NOT NULL,
    tax_in_paise INTEGER NOT NULL,
    shipping_in_paise INTEGER NOT NULL,
    discount_in_paise INTEGER DEFAULT 0,
    total_in_paise INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. AGENT AUDIT & REASONING LOGS TABLE (Day 6 checkpoint)
CREATE TABLE IF NOT EXISTS agent_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    turn_index INTEGER NOT NULL,
    user_input TEXT,
    agent_reasoning TEXT,
    tool_called VARCHAR(64),
    tool_args JSONB,
    tool_result JSONB,
    state_before JSONB,
    state_after JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_product_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_variant_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_session ON agent_audit_logs(session_id);
