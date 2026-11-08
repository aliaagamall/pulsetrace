const { randomUUID } = require("node:crypto");
const AppError = require("../errors/app-error");
const PaymentClient = require("../clients/payment.client");
const { isUuid } = require("../utils/uuid");

class OrderService {
  constructor(orderRepository, paymentClient = new PaymentClient()) {
    this.orderRepository = orderRepository;
    this.paymentClient = paymentClient;
  }

  validateOrderInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new AppError(400, "INVALID_REQUEST_BODY", "Request body must be a JSON object.");
    }

    const { customerId, amount, currency, simulateFailure } = input;

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      throw new AppError(400, "INVALID_CUSTOMER_ID", "A valid customerId is required.");
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, "INVALID_AMOUNT", "Amount must be a positive number.");
    }

    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      throw new AppError(400, "INVALID_CURRENCY", "Currency must be a valid three-letter uppercase code.");
    }

    if (simulateFailure !== undefined && typeof simulateFailure !== "boolean") {
      throw new AppError(400, "INVALID_SIMULATION_VALUE", "simulateFailure must be a boolean.");
    }

    if (process.env.NODE_ENV === "production" && simulateFailure !== undefined) {
      throw new AppError(400, "SIMULATION_NOT_ALLOWED", "Payment simulation is not allowed in production.");
    }
  }

  // context carries the request ID and the request logger (both optional).
  async createOrder(input = {}, context = {}) {
    this.validateOrderInput(input);

    const { customerId, amount, currency, simulateFailure } = input;
    const { requestId, logger } = context;
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

    const createdOrder = await this.orderRepository.create(order);

    try {
      const paymentData = {
        orderId: createdOrder.id,
        amount,
        currency
      };

      if (simulateFailure !== undefined) {
        paymentData.simulateFailure = simulateFailure;
      }

      const payment = await this.paymentClient.createPayment(
        paymentData,
        { requestId }
      );

      const updatedOrder = await this.orderRepository.update(createdOrder.id, {
        status: payment.status === "SUCCEEDED" ? "PAID" : "PAYMENT_FAILED",
        paymentId: payment.id,
        updatedAt: new Date().toISOString()
      });

      logger?.info(
        {
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          paymentId: payment.id
        },
        "Order payment processed"
      );

      return updatedOrder;
    } catch (error) {
      logger?.error(
        { error, orderId: createdOrder.id },
        "Payment processing failed, order left PENDING"
      );

      return createdOrder;
    }
  }

  async getOrderById(id) {
    // A malformed ID can never match a stored order.
    if (!isUuid(id)) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found.");
    }

    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found.");
    }

    return order;
  }
}

module.exports = OrderService;