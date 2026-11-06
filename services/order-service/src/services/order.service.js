
const { randomUUID } = require("node:crypto");
const AppError = require("../errors/app-error");

class OrderService {
  constructor(orderRepository) {
    this.orderRepository = orderRepository;
  }

  validateOrderInput(input) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new AppError(
        400,
        "INVALID_REQUEST_BODY",
        "Request body must be a JSON object."
      );
    }

    const { customerId, amount, currency } = input;

    if (
      typeof customerId !== "string" ||
      customerId.trim().length === 0
    ) {
      throw new AppError(
        400,
        "INVALID_CUSTOMER_ID",
        "A valid customerId is required."
      );
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new AppError(
        400,
        "INVALID_AMOUNT",
        "Amount must be a positive number."
      );
    }

    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      throw new AppError(
        400,
        "INVALID_CURRENCY",
        "Currency must be a valid three-letter uppercase code."
      );
    }
  }

  async createOrder(input = {}) {
    this.validateOrderInput(input);

    const { customerId, amount, currency } = input;
    const now = new Date().toISOString();

    const order = {
      id: randomUUID(),
      customerId: customerId.trim(),
      amount,
      currency,
      status: "PENDING",
      paymentId: null,
      createdAt: now,
      updatedAt: now
    };

    return this.orderRepository.create(order);
  }

  async getOrderById(id) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new AppError(
        404,
        "ORDER_NOT_FOUND",
        "Order was not found."
      );
    }

    return order;
  }
}

module.exports = OrderService;
