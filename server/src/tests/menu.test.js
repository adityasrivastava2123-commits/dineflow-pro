import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";

let adminToken;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/dineflow_test");
  const res = await request(app).post("/api/auth/register").send({
    name: "Menu Test Admin",
    phone: "9222222220",
    password: "admin123",
    role: "admin",
  });
  adminToken = res.body.data?.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("GET /api/menu", () => {
  it("should return 404 for unknown restaurant slug", async () => {
    const res = await request(app).get("/api/menu?slug=nonexistent-restaurant-xyz");
    expect(res.status).toBe(404);
  });
});

describe("Recommendation Engine", () => {
  it("should return 404 for unknown restaurant slug in recommendations", async () => {
    const res = await request(app).get("/api/menu/nonexistent-slug/recommendations?cartItems=");
    expect(res.status).toBe(404);
  });
});
