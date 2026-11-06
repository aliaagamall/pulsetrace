
class InMemoryOrderRepository {
  constructor() {
    this.orders = new Map();
  }

  async create(order) {
    this.orders.set(order.id, order);

    return order;
  }

  async findById(id) {
    return this.orders.get(id) || null;
  }

  async update(id, updates) {
    const order = await this.findById(id);

    if (!order) {
      return null;
    }

    const updatedOrder = {
      ...order,
      ...updates
    };

    this.orders.set(id, updatedOrder);

    return updatedOrder;
  }
}

module.exports = InMemoryOrderRepository;
