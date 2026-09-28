import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Profile, Trip } from "../models/index.js";

const DEFAULT_PREFERENCES = {
  interests: [],
  dislikes: [],
  preferredDestinations: [],
  travelStyle: "",
  transportation: "",
  foodPreference: "",
  typicalBudget: null,
};

const CATEGORY_BY_PREFERENCE = {
  interests: "likes",
  dislikes: "dislikes",
  preferredDestinations: "destinations",
  travelStyle: "style",
  transportation: "transportation",
  foodPreference: "food",
  typicalBudget: "budget",
};

function normalizeProfile(profile, sessionKey) {
  const plain = typeof profile?.toObject === "function" ? profile.toObject() : profile;
  return {
    sessionKey,
    preferences: { ...DEFAULT_PREFERENCES, ...(plain?.preferences ?? {}) },
    memories: (plain?.memories ?? []).map((memory) => ({
      id: memory.id,
      text: memory.text,
      category: memory.category,
      isCurrent: memory.isCurrent !== false,
      createdAt: memory.createdAt,
    })),
  };
}

function applyProfileUpdates(profile, preferences, memories) {
  const replacedCategories = new Set(Object.entries(preferences)
    .filter(([key, value]) => CATEGORY_BY_PREFERENCE[key]
      && (Array.isArray(value) ? value.length > 0 : value !== "" && value !== null))
    .map(([key]) => CATEGORY_BY_PREFERENCE[key]));

  const currentPreferences = typeof profile.preferences?.toObject === "function"
    ? profile.preferences.toObject()
    : profile.preferences;
  profile.preferences = { ...currentPreferences, ...preferences };
  for (const memory of profile.memories) {
    if (replacedCategories.has(memory.category)) memory.isCurrent = false;
  }
  for (const memory of memories) {
    const existing = profile.memories.find((item) => item.text.toLowerCase() === memory.text.toLowerCase());
    if (existing) {
      existing.isCurrent = true;
    } else {
      profile.memories.push({ id: randomUUID(), ...memory, isCurrent: true, createdAt: new Date().toISOString() });
    }
  }
  return profile;
}

function normalizeTrip(trip) {
  if (!trip) return null;
  const plain = typeof trip.toObject === "function" ? trip.toObject() : trip;
  const { _id, __v, sessionKey, ...publicFields } = plain;
  return { ...publicFields, id: String(_id ?? plain.id) };
}

class JsonStore {
  mode = "demo-file";
  writeQueue = Promise.resolve();

  constructor(filePath = resolve(fileURLToPath(new URL("../../.data/tripmind.json", import.meta.url)))) {
    this.filePath = filePath;
  }

  async readData() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return { profiles: {}, trips: [] };
      throw error;
    }
  }

  async mutate(mutator) {
    const operation = this.writeQueue.then(async () => {
      const data = await this.readData();
      const result = await mutator(data);
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
      await rename(tempPath, this.filePath);
      return result;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async read(reader) {
    await this.writeQueue;
    return reader(await this.readData());
  }

  async getProfile(sessionKey) {
    return this.read((data) => normalizeProfile(data.profiles[sessionKey], sessionKey));
  }

  async savePreferences(sessionKey, preferences, memories) {
    return this.mutate((data) => {
      const profile = normalizeProfile(data.profiles[sessionKey], sessionKey);
      applyProfileUpdates(profile, preferences, memories);
      data.profiles[sessionKey] = profile;
      return profile;
    });
  }

  async addMemory(sessionKey, text, category = "note") {
    return this.mutate((data) => {
      const profile = normalizeProfile(data.profiles[sessionKey], sessionKey);
      const existing = profile.memories.find((item) => item.text.toLowerCase() === text.toLowerCase());
      if (existing) {
        existing.isCurrent = true;
      } else {
        profile.memories.push({ id: randomUUID(), text, category, isCurrent: true, createdAt: new Date().toISOString() });
      }
      data.profiles[sessionKey] = profile;
      return profile;
    });
  }

  async clearMemory(sessionKey) {
    return this.mutate((data) => {
      const profile = normalizeProfile(data.profiles[sessionKey], sessionKey);
      profile.preferences = { ...DEFAULT_PREFERENCES };
      profile.memories = [];
      data.profiles[sessionKey] = profile;
    });
  }

  async listTrips(sessionKey) {
    return this.read((data) => data.trips
      .filter((trip) => trip.sessionKey === sessionKey)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(normalizeTrip));
  }

  async getTrip(sessionKey, id) {
    return this.read((data) => normalizeTrip(data.trips.find((trip) => trip.sessionKey === sessionKey && trip.id === id) ?? null));
  }

  async saveTrip(sessionKey, trip) {
    return this.mutate((data) => {
      const saved = { id: randomUUID(), sessionKey, ...trip, createdAt: new Date().toISOString() };
      data.trips.push(saved);
      return normalizeTrip(saved);
    });
  }
}

class MongoStore {
  mode = "mongodb";

  constructor({ profileModel = Profile, tripModel = Trip, mongooseApi = mongoose } = {}) {
    this.profileModel = profileModel;
    this.tripModel = tripModel;
    this.mongooseApi = mongooseApi;
  }

  async getProfile(sessionKey) {
    const profile = await this.profileModel.findOne({ sessionKey }).lean();
    return normalizeProfile(profile, sessionKey);
  }

  async savePreferences(sessionKey, preferences, memories) {
    const profile = await this.profileModel.findOneAndUpdate(
      { sessionKey },
      { $setOnInsert: { sessionKey }, $set: { ...Object.fromEntries(Object.entries(preferences).map(([key, value]) => [`preferences.${key}`, value])) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    applyProfileUpdates(profile, preferences, memories);
    await profile.save();
    return normalizeProfile(profile, sessionKey);
  }

  async addMemory(sessionKey, text, category = "note") {
    const profile = await this.profileModel.findOneAndUpdate(
      { sessionKey },
      { $setOnInsert: { sessionKey } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const existing = profile.memories.find((item) => item.text.toLowerCase() === text.toLowerCase());
    if (existing) {
      existing.isCurrent = true;
    } else {
      profile.memories.push({ id: randomUUID(), text, category, isCurrent: true });
      await profile.save();
    }
    return normalizeProfile(profile, sessionKey);
  }

  async clearMemory(sessionKey) {
    await this.profileModel.updateOne(
      { sessionKey },
      { $set: { preferences: DEFAULT_PREFERENCES, memories: [] }, $setOnInsert: { sessionKey } },
      { upsert: true },
    );
  }

  async listTrips(sessionKey) {
    return (await this.tripModel.find({ sessionKey }).sort({ createdAt: -1 }).lean()).map(normalizeTrip);
  }

  async getTrip(sessionKey, id) {
    if (!this.mongooseApi.isValidObjectId(id)) return null;
    return normalizeTrip(await this.tripModel.findOne({ _id: id, sessionKey }).lean());
  }

  async saveTrip(sessionKey, trip) {
    return normalizeTrip(await this.tripModel.create({ sessionKey, ...trip }));
  }
}

export async function connectStore(mongodbUri) {
  if (!mongodbUri) return createJsonStore();
  await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Profile.init(), Trip.init()]);
  return createMongoStore();
}

export function createMongoStore(options) {
  return new MongoStore(options);
}

export function createJsonStore(filePath) {
  return new JsonStore(filePath);
}

export function createMemoryStore() {
  const profiles = new Map();
  const trips = new Map();
  return {
    mode: "test-memory",
    async getProfile(key) {
      return normalizeProfile(profiles.get(key), key);
    },
    async savePreferences(key, preferences, memories) {
      const profile = normalizeProfile(profiles.get(key), key);
      applyProfileUpdates(profile, preferences, memories);
      profiles.set(key, profile);
      return profile;
    },
    async addMemory(key, text, category = "note") {
      const profile = normalizeProfile(profiles.get(key), key);
      const existing = profile.memories.find((item) => item.text.toLowerCase() === text.toLowerCase());
      if (existing) {
        existing.isCurrent = true;
      } else {
        profile.memories.push({ id: randomUUID(), text, category, isCurrent: true });
      }
      profiles.set(key, profile);
      return profile;
    },
    async clearMemory(key) {
      profiles.set(key, normalizeProfile(undefined, key));
    },
    async listTrips(key) {
      return (trips.get(key) ?? []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async getTrip(key, id) {
      return (trips.get(key) ?? []).find((trip) => trip.id === id) ?? null;
    },
    async saveTrip(key, trip) {
      const saved = { id: randomUUID(), ...trip, createdAt: new Date().toISOString() };
      trips.set(key, [...(trips.get(key) ?? []), saved]);
      return saved;
    },
  };
}
