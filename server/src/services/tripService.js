import { extractUsefulMemories } from "../utils/memory.js";
import { buildDemoPlan } from "./aiService.js";

function preferencesForMemory(request, profile) {
  const updates = {};
  if (request.interests.length) updates.interests = request.interests;
  if (request.dislikes.length) updates.dislikes = request.dislikes;
  if (request.preferredDestinations?.length) updates.preferredDestinations = request.preferredDestinations;
  if (request.travelStyle) updates.travelStyle = request.travelStyle;
  if (request.transportation) updates.transportation = request.transportation;
  if (request.foodPreference) updates.foodPreference = request.foodPreference;
  if (request.budget !== null) updates.typicalBudget = request.budget;
  return { ...profile.preferences, ...updates };
}

function personalizationQuery(request, preferences) {
  return [
    request.destination && `Trip to ${request.destination}`,
    request.interests.join(" "),
    request.dislikes.join(" "),
    request.preferredDestinations?.join(" "),
    request.additionalNotes,
    `Plan a ${request.days}-day trip using relevant travel preferences, usual budget, travel style, favorite experiences, and disliked experiences.`,
    preferences.typicalBudget && `budget ${preferences.typicalBudget}`,
  ].filter(Boolean).join(". ").slice(0, 1000);
}

function relevantProfileMemories(memories, request) {
  const asksAboutTripHistory = /\b(previous|last|similar|same|again|repeat|return)\b/i.test(request.additionalNotes);
  return memories
    .filter((memory) => memory.isCurrent !== false)
    .filter((memory) => memory.category !== "previous-trip"
      || !request.destination
      || asksAboutTripHistory
      || memory.text.toLowerCase().includes(request.destination.toLowerCase()))
    .map((memory) => memory.text);
}

function personalizationReasons(request, preferences, memoriesUsed) {
  const reasons = [];
  const interests = request.interests.length ? request.interests : preferences.interests;
  if (interests.length) reasons.push(`Makes room for what you enjoy: ${interests.join(", ")}.`);
  if (request.dislikes.length) reasons.push(`Avoids your current request to skip ${request.dislikes.join(", ")}.`);
  else if (preferences.dislikes.length) reasons.push(`Keeps your saved dislikes in mind: ${preferences.dislikes.join(", ")}.`);
  if (request.travelStyle) reasons.push(`Uses the ${request.travelStyle.toLowerCase()} pace you chose for this trip.`);
  else if (preferences.travelStyle) reasons.push(`Reflects your saved ${preferences.travelStyle.toLowerCase()} travel style.`);
  if (request.budget !== null) reasons.push(`Uses the ₹${request.budget.toLocaleString("en-IN")} budget you set for this trip.`);
  else if (preferences.typicalBudget) reasons.push(`Uses your saved typical budget of ₹${preferences.typicalBudget.toLocaleString("en-IN")}.`);
  if (preferences.preferredDestinations?.length && !request.destination) {
    reasons.push(`Keeps places you enjoy returning to in mind: ${preferences.preferredDestinations.join(", ")}.`);
  }
  if (memoriesUsed.length) reasons.push("Uses relevant preferences from your TripMind travel memory.");
  return reasons.slice(0, 5);
}

export function createTripService({ store, ai, hindsight, logger = console }) {
  return {
    async plan(profileKey, request) {
      const originalProfile = await store.getProfile(profileKey);
      const memoriesToSave = request.rememberPreferences ? extractUsefulMemories(request) : [];
      const preferences = request.rememberPreferences
        ? preferencesForMemory(request, originalProfile)
        : originalProfile.preferences;

      let profile = originalProfile;
      if (memoriesToSave.length) {
        const preferenceUpdates = request.rememberPreferences
          ? Object.fromEntries(Object.entries(preferences).filter(([key, value]) => value !== originalProfile.preferences[key]))
          : {};
        profile = await store.savePreferences(profileKey, preferenceUpdates, memoriesToSave);
      }

      let recalled = [];
      let memoryWarning = null;
      if (hindsight.configured) {
        try {
          recalled = await hindsight.recall(profileKey, personalizationQuery(request, profile.preferences));
          const outdated = new Set(profile.memories
            .filter((memory) => memory.isCurrent === false)
            .map((memory) => memory.text.toLowerCase()));
          recalled = recalled.filter((memory) => !outdated.has(memory.toLowerCase()));
        } catch (error) {
          logger.error("Hindsight recall failed:", error);
          memoryWarning = "We couldn't reach your long-term travel memory, so this plan uses your saved profile instead.";
        }
      }
      const allMemoryContext = [
        ...recalled,
        ...relevantProfileMemories(profile.memories, request),
      ].filter((text, index, list) => list.indexOf(text) === index).slice(0, 8);

      let aiResult;
      try {
        aiResult = await ai.generate(request, profile.preferences, allMemoryContext, request.budget ?? profile.preferences.typicalBudget);
      } catch (error) {
        logger.error("LLM itinerary generation failed:", error);
        aiResult = {
          plan: buildDemoPlan(request, profile.preferences, allMemoryContext, request.budget ?? profile.preferences.typicalBudget),
          mode: "demo",
          warning: "The AI service is temporarily unavailable. This clearly labelled sample plan is shown instead.",
        };
      }

      const plan = {
        ...aiResult.plan,
        whyThisFits: personalizationReasons(request, profile.preferences, allMemoryContext),
      };
      const savedTrip = await store.saveTrip(profileKey, {
        destination: plan.destination,
        days: request.days,
        budget: plan.totalEstimatedBudget,
        currency: plan.currency || "INR",
        summary: plan.summary,
        itinerary: plan.days,
        foodSuggestions: plan.foodSuggestions,
        transportSuggestions: plan.transportSuggestions,
        tips: plan.tips,
        memoriesUsed: allMemoryContext,
        whyThisFits: plan.whyThisFits,
        generationMode: aiResult.mode,
      });
      const memoriesSaved = memoriesToSave.map((item) => item.text);
      if (request.rememberPreferences) {
        const tripMemoryText = `The traveler planned a ${request.days}-day trip to ${plan.destination}.`;
        try {
          profile = await store.addMemory(profileKey, tripMemoryText, "previous-trip");
          memoriesSaved.push(tripMemoryText);
        } catch (error) {
          logger.error("Trip memory save failed:", error);
          memoryWarning = "Your trip was saved, but its destination couldn't be added to your travel memory.";
        }
      }

      if (hindsight.configured && (memoriesToSave.length || memoriesSaved.some((text) => text.includes(" planned a ")))) {
        try {
          const textsToRetain = new Set(memoriesSaved);
          await hindsight.retain(profileKey, profile.memories.filter((memory) => textsToRetain.has(memory.text)));
        } catch (error) {
          logger.error("Hindsight retain failed:", error);
          memoryWarning = "Your preferences are saved in TripMind, but long-term memory could not be updated right now.";
        }
      }
      return {
        trip: savedTrip,
        memoriesUsed: allMemoryContext,
        memoriesSaved,
        warnings: [aiResult.warning, memoryWarning].filter(Boolean),
      };
    },
  };
}
