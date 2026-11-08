class PostgresPaymentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  mapPayment(row) {
    if (!row) return null;

    return {
      id: row.id,
      orderId: row.order_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at.toISOString()
    };
  }

  async create(payment) {
    const result = await this.pool.query(
      `INSERT INTO payments (
        id, order_id, amount, currency, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        payment.id,
        payment.orderId,
        payment.amount,
        payment.currency,
        payment.status,
        payment.createdAt
      ]
    );

    return this.mapPayment(result.rows[0]);
  }

  async findById(id) {
    const result = await this.pool.query(
      "SELECT * FROM payments WHERE id = $1",
      [id]
    );

    return this.mapPayment(result.rows[0]);
  }
}

module.exports = PostgresPaymentRepository;
