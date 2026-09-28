import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { HindsightError } from "@vectorize-io/hindsight-client";
import { createHindsightService } from "../src/services/hindsightService.js";
import { createTripService } from "../src/services/tripService.js";
import { createJsonStore, createMemoryStore, createMongoStore } from "../src/services/store.js";
import { extractUsefulMemories } from "../src/utils/memory.js";
import { validateMemoryText, validateTripRequest } from "../src/utils/validation.js";

const silentLogger = { error() {} };
const tripInput = {
  destination: "",
  days: 2,
  budget: null,
  interests: ["Nature"],
  dislikes: ["Crowds"],
  travelStyle: "Relaxed",
  transportation: "",
  foodPreference: "",
  additionalNotes: "",
  rememberPreferences: true,
};

test("validates optional destination, bounded duration, lists, and malformed data", () => {
  assert.equal(validateTripRequest({ ...tripInput, days: "4" }).value.days, 4);
  assert.equal(validateTripRequest({ ...tripInput, days: 22 }).error, "Choose a trip length between 1 and 21 days.");
  assert.match(validateTripRequest({ ...tripInput, additionalNotes: "Email me at traveler@example.com" }).error, /remove contact/);
  assert.ok(validateTripRequest(null).error);
});

test("retains meaningful preferences but ignores greetings and trip-only requests", () => {
  const memories = extractUsefulMemories({
    ...tripInput,
    interests: [],
    dislikes: [],
    additionalNotes: "Hi. Plan a trip. I usually prefer quiet places; I hate crowded attractions.",
  });
  assert.deepEqual(memories.map((item) => item.text), [
    "I usually prefer quiet places.",
    "I hate crowded attractions.",
  ]);
  assert.equal(extractUsefulMemories({
    ...tripInput,
    interests: [],
    dislikes: [],
    additionalNotes: "Thanks",
  }).length, 0);
  assert.equal(validateMemoryText({ text: "Thanks" }).value, "Thanks");
});

test("falls back to a clearly labelled sample when the LLM fails", async () => {
  const store = createMemoryStore();
  const service = createTripService({
    store,
    ai: { configured: true, async generate() { throw new Error("provider offline"); } },
    hindsight: { configured: false, async recall() { return []; } },
    logger: silentLogger,
  });
  const result = await service.plan("traveler-a", tripInput);
  assert.equal(result.trip.generationMode, "demo");
  assert.match(result.warnings[0], /sample plan/);
  assert.equal(result.trip.itinerary.length, 2);
  assert.match(result.trip.destination, /getaway/);
});

test("continues trip planning with structured preferences when Hindsight recall fails", async () => {
  const store = createMemoryStore();
  const service = createTripService({
    store,
    ai: {
      configured: true,
      async generate(request, preferences, memories) {
        return {
          plan: {
            destination: "Coorg",
            days: Array.from({ length: request.days }, () => ({
              morning: "Rest.", afternoon: "Explore.", evening: "Eat.", estimatedSpend: null,
            })),
            totalEstimatedBudget: null,
            summary: "A peaceful plan.",
            tips: [],
            foodSuggestions: [],
            transportSuggestions: [],
            whyThisFits: [],
          },
          mode: "ai",
          warning: null,
        };
      },
    },
    hindsight: {
      configured: true,
      async recall() { throw new Error("Hindsight offline"); },
      async retain() {},
    },
    logger: silentLogger,
  });
  const result = await service.plan("traveler-a", tripInput);
  assert.equal(result.trip.generationMode, "ai");
  assert.ok(result.warnings.some((message) => /long-term travel memory/.test(message)));
});

test("uses the latest explicit preference instead of an older conflicting one", async () => {
  const store = createMemoryStore();
  await store.savePreferences("traveler-a", { interests: ["Beaches"] }, [
    { text: "The traveler enjoys Beaches.", category: "likes" },
  ]);
  let memoryContext = [];
  const service = createTripService({
    store,
    ai: {
      configured: true,
      async generate(request, preferences, memories, budget) {
        memoryContext = memories;
        return {
          plan: {
            destination: "Coorg",
            days: Array.from({ length: request.days }, () => ({
              morning: "Rest.", afternoon: "Explore.", evening: "Eat.", estimatedSpend: null,
            })),
            totalEstimatedBudget: budget,
            summary: "A current-preference plan.",
            tips: [],
            foodSuggestions: [],
            transportSuggestions: [],
            whyThisFits: [],
          },
          mode: "ai",
          warning: null,
        };
      },
    },
    hindsight: { configured: false, async recall() { return []; } },
    logger: silentLogger,
  });

  await service.plan("traveler-a", { ...tripInput, interests: ["Mountains"] });
  const savedProfile = await store.getProfile("traveler-a");
  assert.deepEqual(savedProfile.preferences.interests, ["Mountains"]);
  assert.ok(savedProfile.memories.some((item) => item.text.includes("Beaches") && !item.isCurrent));
  assert.ok(memoryContext.some((memory) => memory.includes("Mountains")));
  assert.ok(memoryContext.every((memory) => !memory.includes("Beaches")));
});

test("uses a distinct Hindsight bank for each browser profile", async () => {
  const recalledBanks = [];
  const retainedBanks = [];
  const client = {
    async getBankConfig() { return {}; },
    async recall(bankId) {
      recalledBanks.push(bankId);
      return { results: [{ text: "The traveler prefers quiet places." }] };
    },
    async retainBatch(bankId, items, options) {
      retainedBanks.push({ bankId, items, options });
    },
    async deleteDocument() {},
  };
  const hindsight = createHindsightService({
    signingSecret: "test-hindsight-secret",
    client,
  });
  const [a, b] = await Promise.all([
    hindsight.recall("profile-a", "quiet trip"),
    hindsight.recall("profile-b", "quiet trip"),
  ]);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.notEqual(recalledBanks[0], recalledBanks[1]);
  await hindsight.retain("profile-a", [{ id: "memory-1", text: "Likes quiet places.", category: "likes" }]);
  assert.equal(retainedBanks[0].items[0].document_id, "memory-1");
  await hindsight.clear("profile-a", [{ id: "memory-1" }]);
});

test("creates scoped MongoDB query filters for trip reads and writes", async () => {
  let findQuery;
  let createRecord;
  const profileModel = {
    async findOneAndUpdate() {
      return { preferences: {}, memories: [], async save() {} };
    },
    findOne(query) {
      return { async lean() { return { sessionKey: query.sessionKey, preferences: {}, memories: [] }; } };
    },
    async updateOne() {},
  };
  const tripModel = {
    find(query) {
      findQuery = query;
      return { sort() { return { async lean() { return []; } }; } };
    },
    findOne(query) {
      findQuery = query;
      return { async lean() { return null; } };
    },
    async create(record) {
      createRecord = record;
      return { _id: "507f1f77bcf86cd799439011", ...record };
    },
  };
  const store = createMongoStore({
    profileModel,
    tripModel,
    mongooseApi: { isValidObjectId: (value) => /^[0-9a-f]{24}$/i.test(value) },
  });

  await store.listTrips("traveler-a");
  assert.deepEqual(findQuery, { sessionKey: "traveler-a" });
  assert.equal(await store.getTrip("traveler-b", "507f1f77bcf86cd799439011"), null);
  assert.deepEqual(findQuery, { _id: "507f1f77bcf86cd799439011", sessionKey: "traveler-b" });
  await store.saveTrip("traveler-a", { destination: "Coorg", days: 2, itinerary: [] });
  assert.equal(createRecord.sessionKey, "traveler-a");
});

test("allows an already-absent Hindsight document during a confirmed clear", async () => {
  const client = {
    async getBankConfig() { return {}; },
    async deleteDocument() { throw new HindsightError("not found", 404); },
  };
  const hindsight = createHindsightService({ signingSecret: "test-secret", client });
  await assert.doesNotReject(hindsight.clear("profile-a", [{ id: "old-memory" }]));
});

test("persists demo profiles and trips across local-store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tripmind-store-"));
  const filePath = join(directory, "tripmind.json");
  try {
    const firstRun = createJsonStore(filePath);
    await firstRun.savePreferences("profile-a", { preferredDestinations: ["Coorg"] }, [
      { text: "The traveler likes returning to Coorg.", category: "destinations" },
    ]);
    await firstRun.saveTrip("profile-a", { destination: "Coorg", days: 2, itinerary: [] });

    const afterRestart = createJsonStore(filePath);
    assert.deepEqual((await afterRestart.getProfile("profile-a")).preferences.preferredDestinations, ["Coorg"]);
    assert.equal((await afterRestart.listTrips("profile-a")).length, 1);
    assert.equal((await afterRestart.listTrips("profile-b")).length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
