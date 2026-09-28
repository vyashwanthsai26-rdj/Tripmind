import mongoose from "mongoose";

const preferenceSchema = new mongoose.Schema({
  interests: { type: [String], default: [] },
  dislikes: { type: [String], default: [] },
  preferredDestinations: { type: [String], default: [] },
  travelStyle: { type: String, default: "" },
  transportation: { type: String, default: "" },
  foodPreference: { type: String, default: "" },
  typicalBudget: { type: Number, default: null },
}, { _id: false });

const memorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  category: { type: String, default: "preference" },
  isCurrent: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const profileSchema = new mongoose.Schema({
  sessionKey: { type: String, required: true, unique: true, index: true },
  preferences: { type: preferenceSchema, default: () => ({}) },
  memories: { type: [memorySchema], default: [] },
}, { timestamps: true });

const daySchema = new mongoose.Schema({
  title: { type: String, default: "" },
  morning: { type: String, default: "" },
  afternoon: { type: String, default: "" },
  evening: { type: String, default: "" },
  estimatedSpend: { type: Number, default: null },
}, { _id: false });

const tripSchema = new mongoose.Schema({
  sessionKey: { type: String, required: true, index: true },
  destination: { type: String, required: true },
  days: { type: Number, required: true },
  budget: { type: Number, default: null },
  currency: { type: String, default: "INR" },
  summary: { type: String, default: "" },
  itinerary: { type: [daySchema], default: [] },
  foodSuggestions: { type: [String], default: [] },
  transportSuggestions: { type: [String], default: [] },
  tips: { type: [String], default: [] },
  memoriesUsed: { type: [String], default: [] },
  whyThisFits: { type: [String], default: [] },
  generationMode: { type: String, enum: ["ai", "demo"], default: "demo" },
}, { timestamps: true });

tripSchema.index({ sessionKey: 1, createdAt: -1 });

export const Profile = mongoose.models.TripMindProfile
  || mongoose.model("TripMindProfile", profileSchema);
export const Trip = mongoose.models.TripMindTrip
  || mongoose.model("TripMindTrip", tripSchema);
