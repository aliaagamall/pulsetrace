CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    customer_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL
        CHECK (currency ~ '^[A-Z]{3}$'),
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('PENDING', 'PAID', 'PAYMENT_FAILED')),
    payment_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON orders (customer_id);
