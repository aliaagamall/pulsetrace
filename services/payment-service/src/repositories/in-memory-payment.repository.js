class InMemoryPaymentRepository {
  constructor() {
    this.payments = new Map();
  }

  async create(payment) {
    this.payments.set(payment.id, payment);

    return payment;
  }

  async findById(id) {
    return this.payments.get(id) || null;
  }
}

module.exports = InMemoryPaymentRepository;