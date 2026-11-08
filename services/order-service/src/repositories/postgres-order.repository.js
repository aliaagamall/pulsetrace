class PostgresOrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  mapOrder(row) {
    if (!row) return null;

    return {
      id: row.id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paymentId: row.payment_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async create(order) {
    const result = await this.pool.query(
      `INSERT INTO orders (
        id, customer_id, amount, currency, status,
        payment_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        order.id,
        order.customerId,
        order.amount,
        order.currency,
        order.status,
        order.paymentId,
        order.createdAt,
        order.updatedAt
      ]
    );

    return this.mapOrder(result.rows[0]);
  }

  async findById(id) {
    const result = await this.pool.query(
      "SELECT * FROM orders WHERE id = $1",
      [id]
    );

    return this.mapOrder(result.rows[0]);
  }

  async update(id, updates) {
    const allowedColumns = {
      status: "status",
      paymentId: "payment_id",
      updatedAt: "updated_at"
    };

    const entries = Object.entries(updates);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const values = [];
    const assignments = [];

    for (const [key, value] of entries) {
      const column = allowedColumns[key];

      if (!column) {
        throw new Error(`Unsupported order update field: ${key}`);
      }

      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }

    values.push(id);

    const result = await this.pool.query(
      `UPDATE orders
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    return this.mapOrder(result.rows[0]);
  }
}

module.exports = PostgresOrderRepository;
