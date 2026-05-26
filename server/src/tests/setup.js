import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

// Silence logger during tests
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
