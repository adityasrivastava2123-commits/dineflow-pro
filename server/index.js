/**
 * DineFlow Pro — Server Entry Point
 *
 * The canonical entry point is: server/src/index.js
 * This file exists for legacy tooling compatibility.
 * npm start / npm run dev both point to src/index.js via package.json.
 */
import("./src/index.js").catch(err => {
  console.error("Failed to start DineFlow server:", err);
  process.exit(1);
});
