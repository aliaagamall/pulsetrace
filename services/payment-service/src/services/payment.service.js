const { randomUUID } = require("node:crypto");
const AppError = require("../errors/app-error");
const { isUuid } = require("../utils/uuid");

class PaymentService {
  constructor(paymentRepository) {
    this.paymentRepository = paymentRepository;
  }

  validatePaymentInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new AppError(400, "INVALID_REQUEST_BODY", "Request body must be a JSON object.");
    }

    const { orderId, amount, currency } = input;

    if (typeof orderId !== "string" || !isUuid(orderId.trim())) {
      throw new AppError(400, "INVALID_ORDER_ID", "A valid orderId (UUID) is required.");
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, "INVALID_AMOUNT", "Amount must be a positive number.");
    }

    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      throw new AppError(400, "INVALID_CURRENCY", "Currency must be a valid three-letter uppercase code.");
    }
  }

  // context carries the request logger (optional).
  async createPayment(input = {}, context = {}) {
    this.validatePaymentInput(input);

    const { orderId, amount, currency } = input;

    if (
      Object.hasOwn(input, "simulateFailure") &&
      typeof input.simulateFailure !== "boolean"
    ) {
      throw new AppError(400, "INVALID_SIMULATION_FLAG", "simulateFailure must be a boolean.");
    }

    if (
      process.env.NODE_ENV === "production" &&
      Object.hasOwn(input, "simulateFailure")
    ) {
      throw new AppError(400, "SIMULATION_NOT_ALLOWED", "Payment simulation is not allowed in production.");
    }

    const status = input.simulateFailure === true ? "FAILED" : "SUCCEEDED";

    const payment = {
      id: randomUUID(),
      orderId: orderId.trim(),
      amount,
      currency,
      status,
      createdAt: new Date().toISOString()
    };

    const createdPayment = await this.paymentRepository.create(payment);

    context.logger?.info(
      {
        paymentId: createdPayment.id,
        orderId: createdPayment.orderId,
        status: createdPayment.status
      },
      "Payment processed"
    );

    return createdPayment;
  }

  async getPaymentById(id) {
    // A malformed ID can never match a stored payment.
    if (!isUuid(id)) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    }

    const payment = await this.paymentRepository.findById(id);

    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    }

    return payment;
  }
}

module.exports = PaymentService;