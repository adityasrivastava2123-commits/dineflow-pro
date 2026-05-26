import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Order from "../models/Order.js";

let adminToken;
let restaurantId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/dineflow_test");

  const res = await request(app).post("/api/auth/register").send({
    name: "Order Test Admin",
    phone: "9111111110",
    password: "admin123",
    role: "admin",
  });
  adminToken = res.body.data?.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await Order.deleteMany({});
});

describe("GET /api/orders", () => {
  it("should require authentication", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("should return orders list for authenticated admin", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.orders)).toBe(true);
  });
});
