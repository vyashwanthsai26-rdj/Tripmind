import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { connectStore } from "./services/store.js";

const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
dotenv.config({ path: resolve(projectRoot, ".env") });

async function start() {
  let signingSecret = process.env.SESSION_SECRET;
  if (signingSecret && signingSecret.length < 32 && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
  }
  if (!signingSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be configured before starting in production.");
    }
    signingSecret = randomBytes(32).toString("base64url");
    console.warn("SESSION_SECRET is not set. This development profile cookie will not survive a server restart.");
  }

  const store = await connectStore(process.env.MONGODB_URI);
  if (store.mode === "demo-file") {
    console.warn("MongoDB is not configured. TripMind is using its local demo data file.");
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. TripMind will label its sample itinerary plans.");
  }
  if (!process.env.HINDSIGHT_BASE_URL) {
    console.warn("HINDSIGHT_BASE_URL is not set. TripMind will use structured profile memory only.");
  }
  const app = createApp({
    store,
    signingSecret,
    production: process.env.NODE_ENV === "production",
  });
  const port = Number(process.env.PORT) || 3001;
  const server = app.listen(port, () => {
    console.log(`TripMind API listening on http://localhost:${port}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("TripMind could not start:", error.message);
  process.exitCode = 1;
});
