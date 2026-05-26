import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Payment from "../models/Payment.js";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/dineflow_test");
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("Payment model audit log", () => {
  it("should add audit events", async () => {
    const fakeOrderId = new mongoose.Types.ObjectId();
    const payment = new Payment({
      order: fakeOrderId,
      amount: 299,
      status: "pending",
      razorpayOrderId: "order_test123",
    });

    payment.addAuditEvent("created", "testuser", { amount: 299 });
    expect(payment.auditLog).toHaveLength(1);
    expect(payment.auditLog[0].event).toBe("created");
    expect(payment.auditLog[0].actor).toBe("testuser");
  });

  it("should enforce status enum", async () => {
    const fakeOrderId = new mongoose.Types.ObjectId();
    const payment = new Payment({
      order: fakeOrderId,
      amount: 100,
      status: "invalid_status",
    });
    const err = payment.validateSync();
    expect(err).toBeDefined();
  });
});

describe("POST /api/payments/webhook", () => {
  it("should return 200 for valid webhook body", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .send({ event: "payment.authorized", payload: {} });
    expect(res.status).toBe(200);
  });
});
