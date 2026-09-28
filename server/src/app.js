import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler, notFound } from "./middleware/errors.js";
import { createUserIdentityMiddleware } from "./middleware/userIdentity.js";
import { createApiRouter } from "./routes/api.js";
import { createAiService } from "./services/aiService.js";
import { createHindsightService } from "./services/hindsightService.js";
import { createTripService } from "./services/tripService.js";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function createApp({
  store,
  ai,
  hindsight,
  signingSecret,
  production = false,
  logger = console,
} = {}) {
  if (!store) throw new Error("TripMind requires a data store.");
  const activeAi = ai ?? createAiService({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  });
  const activeHindsight = hindsight ?? createHindsightService({
    baseUrl: process.env.HINDSIGHT_BASE_URL,
    apiKey: process.env.HINDSIGHT_API_KEY,
    signingSecret,
  });
  const tripService = createTripService({ store, ai: activeAi, hindsight: activeHindsight, logger });
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { imgSrc: ["'self'", "data:", "https://images.unsplash.com"] },
    },
  }));
  app.use(express.json({ limit: "20kb" }));
  app.use(createUserIdentityMiddleware(signingSecret, { secure: production }));
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
      success: false,
      error: { message: "Too many requests. Please wait a little and try again." },
    }),
  }));
  app.use("/api", createApiRouter({ store, tripService, ai: activeAi, hindsight: activeHindsight }));

  if (production) {
    const clientDist = resolve(projectRoot, "client", "dist");
    app.use(express.static(clientDist, { index: false }));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
      res.sendFile(resolve(clientDist, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use("/api", notFound);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
