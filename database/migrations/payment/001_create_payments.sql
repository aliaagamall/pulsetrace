CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL
        CHECK (currency ~ '^[A-Z]{3}$'),
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('SUCCEEDED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON payments (order_id);
