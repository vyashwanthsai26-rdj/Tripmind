import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryStore } from "../src/services/store.js";

const quietLogger = { error() {} };

function createTestApp({ ai, hindsight } = {}) {
  const store = createMemoryStore();
  const generatedAi = ai ?? {
    configured: true,
    async generate(trip, preferences, memories, budget) {
      return {
        plan: {
          destination: trip.destination || "Quiet Highlands",
          days: Array.from({ length: trip.days }, (_, index) => ({
            title: `Day ${index + 1}`,
            morning: "Take a slow start.",
            afternoon: "Explore at an easy pace.",
            evening: "Enjoy a quiet meal.",
            estimatedSpend: budget === null ? null : Math.round(budget / trip.days),
          })),
          totalEstimatedBudget: budget,
          currency: "INR",
          summary: "A relaxed test itinerary.",
          tips: ["Check local details before travelling."],
          foodSuggestions: ["Try a local meal."],
          transportSuggestions: ["Check local transport."],
          whyThisFits: memories,
        },
        mode: "ai",
        warning: null,
      };
    },
  };
  const memory = hindsight ?? {
    configured: false,
    async recall() { return []; },
    async retain() {},
    async clear() {},
  };
  return {
    app: createApp({
      store,
      ai: generatedAi,
      hindsight: memory,
      signingSecret: "test-session-secret-that-is-long-enough",
      logger: quietLogger,
    }),
    store,
  };
}

const validTrip = {
  destination: "Coorg",
  days: 3,
  budget: 18000,
  interests: ["Nature"],
  dislikes: ["Crowds"],
  travelStyle: "Relaxed",
  transportation: "Train",
  foodPreference: "Local food",
  additionalNotes: "I usually prefer peaceful places.",
  rememberPreferences: true,
};

test("rejects invalid trip requests with the shared error envelope", async () => {
  const { app } = createTestApp();
  const response = await request(app).post("/api/trip/plan").send({ ...validTrip, days: 0 });
  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /1 and 21 days/);
});

test("plans and saves a trip, retains explicit preferences, and returns an HTTP-only profile cookie", async () => {
  const { app } = createTestApp();
  const profile = request.agent(app);
  const response = await profile.post("/api/trip/plan").send(validTrip);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.trip.destination, "Coorg");
  assert.equal(response.body.data.trip.itinerary.length, 3);
  assert.equal(response.body.data.trip.generationMode, "ai");
  assert.equal("sessionKey" in response.body.data.trip, false);
  assert.ok(response.body.data.trip.memoriesUsed.some((memory) => /dislikes Crowds/.test(memory)));
  assert.ok(response.headers["set-cookie"].some((cookie) => /HttpOnly/i.test(cookie)));

  const [trips, savedProfile] = await Promise.all([
    profile.get("/api/trips"),
    profile.get("/api/memory"),
  ]);
  assert.equal(trips.body.data.length, 1);
  assert.equal(trips.body.data[0].id, response.body.data.trip.id);
  assert.equal(savedProfile.body.data.preferences.typicalBudget, 18000);
  assert.ok(savedProfile.body.data.memories.some((item) => /dislikes Crowds/.test(item.text)));
  assert.ok(savedProfile.body.data.memories.some((item) => /usually prefer peaceful places/.test(item.text)));
  assert.ok(savedProfile.body.data.memories.some((item) => item.category === "previous-trip"));
});

test("isolates trips and trip retrieval between independent browser profiles", async () => {
  const { app } = createTestApp();
  const travelerA = request.agent(app);
  const travelerB = request.agent(app);
  const created = await travelerA.post("/api/trip/plan").send(validTrip);

  assert.equal((await travelerA.get("/api/trips")).body.data.length, 1);
  assert.equal((await travelerB.get("/api/trips")).body.data.length, 0);
  assert.equal((await travelerB.get(`/api/trips/${created.body.data.trip.id}`)).status, 404);
});

test("reports database, AI, and Hindsight configuration through health", async () => {
  const { app } = createTestApp();
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    status: "ok",
    database: "test-memory",
    ai: "configured",
    hindsight: "not-configured",
  });
});
