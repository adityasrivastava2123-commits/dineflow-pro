import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/User.js";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/dineflow_test");
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe("POST /api/auth/register", () => {
  it("should register a new admin user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Admin",
      phone: "9876543210",
      password: "password123",
      role: "admin",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
  });

  it("should reject duplicate phone number", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Test Admin",
      phone: "9876543210",
      password: "password123",
      role: "admin",
    });
    const res = await request(app).post("/api/auth/register").send({
      name: "Another User",
      phone: "9876543210",
      password: "password456",
      role: "admin",
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Test",
      phone: "9998887770",
      password: "testpass123",
      role: "admin",
    });
  });

  it("should login with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      phone: "9998887770",
      password: "testpass123",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("should reject invalid password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      phone: "9998887770",
      password: "wrongpass",
    });
    expect(res.status).toBe(401);
  });
});
