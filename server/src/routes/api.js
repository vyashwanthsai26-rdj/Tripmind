import { Router } from "express";
import { AppError } from "../middleware/errors.js";
import { extractUsefulMemories } from "../utils/memory.js";
import { validateMemoryText, validateTripRequest } from "../utils/validation.js";

const success = (res, data, status = 200) => res.status(status).json({ success: true, data });

export function createApiRouter({ store, tripService, ai, hindsight }) {
  const router = Router();

  router.get("/health", (req, res) => success(res, {
    status: "ok",
    database: store.mode,
    ai: ai.configured ? "configured" : "demo",
    hindsight: hindsight.configured ? "configured" : "not-configured",
  }));

  router.get("/session", (req, res) => success(res, {
    profile: "browser",
    database: store.mode,
    aiConfigured: ai.configured,
    hindsightConfigured: hindsight.configured,
  }));

  router.post("/trip/plan", async (req, res, next) => {
    const validated = validateTripRequest(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, error: { message: validated.error } });
    }
    try {
      return success(res, await tripService.plan(req.profileKey, validated.value), 201);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/trips", async (req, res, next) => {
    try {
      return success(res, await store.listTrips(req.profileKey));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/trips/:id", async (req, res, next) => {
    try {
      const trip = await store.getTrip(req.profileKey, req.params.id);
      if (!trip) return res.status(404).json({ success: false, error: { message: "That trip wasn't found in this browser profile." } });
      return success(res, trip);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/memory", async (req, res, next) => {
    try {
      const profile = await store.getProfile(req.profileKey);
      return success(res, {
        preferences: profile.preferences,
        memories: profile.memories,
        semanticMemoryConfigured: hindsight.configured,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/memory", async (req, res, next) => {
    const validated = validateMemoryText(req.body);
    if (validated.error) return res.status(400).json({ success: false, error: { message: validated.error } });
    const memories = extractUsefulMemories({
      interests: [],
      dislikes: [],
      preferredDestinations: [],
      travelStyle: "",
      transportation: "",
      foodPreference: "",
      budget: null,
      rememberPreferences: true,
      additionalNotes: validated.value,
    });
    if (!memories.length) {
      return res.status(400).json({
        success: false,
        error: { message: "Add a lasting travel preference, such as what you usually enjoy or avoid." },
      });
    }

    try {
      const previous = await store.getProfile(req.profileKey);
      let profile = previous;
      for (const memory of memories) {
        profile = await store.addMemory(req.profileKey, memory.text, memory.category);
      }
      const newIds = new Set(profile.memories
        .filter((item) => !previous.memories.some((saved) => saved.id === item.id))
        .map((item) => item.id));
      const newlyAdded = profile.memories.filter((item) => newIds.has(item.id));
      let warning = null;
      if (newlyAdded.length && hindsight.configured) {
        try {
          await hindsight.retain(req.profileKey, newlyAdded);
        } catch (error) {
          console.error("Hindsight retain failed:", error);
          warning = "Your note is saved in this profile, but long-term memory could not be updated right now.";
        }
      }
      return success(res, {
        preferences: profile.preferences,
        memories: profile.memories,
        warning,
      }, 201);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/memory", async (req, res, next) => {
    try {
      const profile = await store.getProfile(req.profileKey);
      if (hindsight.configured) {
        try {
          await hindsight.clear(req.profileKey, profile.memories);
        } catch (error) {
          console.error("Hindsight memory deletion failed:", error);
          throw new AppError(503, "TripMind couldn't clear its long-term memory. Your saved preferences were left unchanged.");
        }
      }
      await store.clearMemory(req.profileKey);
      return success(res, { cleared: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
