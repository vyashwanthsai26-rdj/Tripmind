import OpenAI from "openai";

function buildDemoPlan(request, preferences, memories, effectiveBudget) {
  const destination = request.destination || "A relaxed getaway of your choice";
  const interest = request.interests[0] || preferences.interests[0] || "a local cultural experience";
  const style = request.travelStyle || preferences.travelStyle || "relaxed";
  const perDay = effectiveBudget === null ? null : Math.round(effectiveBudget / request.days);

  return {
    destination,
    days: Array.from({ length: request.days }, (_, index) => ({
      title: index === 0 ? "Arrive and settle in" : index === request.days - 1 ? "A gentle finish" : `Day ${index + 1} · Explore at your pace`,
      morning: index === 0 ? "Arrive, check in, and leave room to rest." : `Start slowly with a nearby ${interest.toLowerCase()} experience.`,
      afternoon: `Choose one low-pressure activity around ${interest.toLowerCase()} and allow time between stops.`,
      evening: request.dislikes.some((item) => /nightlife|crowd/i.test(item))
        ? "Wind down somewhere quieter; skip nightlife and busy areas."
        : "Enjoy a relaxed meal and keep the evening flexible.",
      estimatedSpend: perDay,
    })),
    totalEstimatedBudget: effectiveBudget,
    currency: "INR",
    summary: `A ${request.days}-day ${style.toLowerCase()} outline for ${destination}. Adjust suggestions to local conditions.`,
    foodSuggestions: request.foodPreference || preferences.foodPreference
      ? [`Look for local options that fit your preference: ${request.foodPreference || preferences.foodPreference}.`]
      : ["Try a well-reviewed local place; check current menus and opening times."],
    transportSuggestions: request.transportation || preferences.transportation
      ? [`Consider your preferred option where available: ${request.transportation || preferences.transportation}.`]
      : ["Check local transit and travel times before choosing how to get around."],
    tips: [
      "This sample outline is not verified against live opening hours, prices, transit, or availability.",
      "Check current local guidance and travel times before booking.",
      request.transportation || preferences.transportation
        ? `Use your preferred option where practical: ${request.transportation || preferences.transportation}.`
        : "Compare local transport options before departure.",
    ],
    whyThisFits: memories.slice(0, 3),
  };
}

function normalizeItinerary(output, request, effectiveBudget) {
  const days = Array.isArray(output.days) ? output.days.slice(0, request.days) : [];
  if (days.length !== request.days || days.some((day) => !day || typeof day !== "object")) {
    throw new Error("The AI returned an incomplete itinerary.");
  }
  const normalizedDays = days.map((day, index) => ({
    title: String(day.title || `Day ${index + 1}`).slice(0, 100),
    morning: String(day.morning || "").slice(0, 500),
    afternoon: String(day.afternoon || "").slice(0, 500),
    evening: String(day.evening || "").slice(0, 500),
    estimatedSpend: day.estimatedSpend !== null
      && day.estimatedSpend !== undefined
      && Number.isFinite(Number(day.estimatedSpend))
      ? Number(day.estimatedSpend)
      : null,
  }));
  if (normalizedDays.some((day) => !day.morning || !day.afternoon || !day.evening)) {
    throw new Error("The AI returned an incomplete day plan.");
  }

  return {
    destination: String(output.destination || request.destination || "Your trip").slice(0, 100),
    days: normalizedDays,
    totalEstimatedBudget: output.totalEstimatedBudget !== null
      && output.totalEstimatedBudget !== undefined
      && Number.isFinite(Number(output.totalEstimatedBudget))
      ? Number(output.totalEstimatedBudget)
      : effectiveBudget,
    currency: "INR",
    summary: String(output.summary || "").slice(0, 500),
    foodSuggestions: Array.isArray(output.foodSuggestions)
      ? output.foodSuggestions.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    transportSuggestions: Array.isArray(output.transportSuggestions)
      ? output.transportSuggestions.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    tips: Array.isArray(output.tips) ? output.tips.filter((tip) => typeof tip === "string").slice(0, 8) : [],
    whyThisFits: Array.isArray(output.whyThisFits)
      ? output.whyThisFits.filter((reason) => typeof reason === "string").slice(0, 6)
      : [],
  };
}

export function createAiService({ apiKey, model = "gpt-4o-mini" }) {
  const client = apiKey ? new OpenAI({ apiKey, timeout: 25000, maxRetries: 1 }) : null;

  return {
    configured: Boolean(client),
    async generate(request, preferences, memories, effectiveBudget) {
      if (!client) {
        return {
          plan: buildDemoPlan(request, preferences, memories, effectiveBudget),
          mode: "demo",
          warning: "Demo plan: add an OpenAI API key to generate a live AI itinerary.",
        };
      }

      const prompt = {
        currentRequest: {
          destination: request.destination || "Choose a suitable destination",
          days: request.days,
          budgetINR: effectiveBudget,
          interests: request.interests,
          dislikes: request.dislikes,
          preferredDestinations: request.preferredDestinations ?? [],
          travelStyle: request.travelStyle,
          transportation: request.transportation,
          foodPreference: request.foodPreference,
          additionalNotes: request.additionalNotes,
        },
        savedPreferences: preferences,
        relevantLongTermMemories: memories,
      };
      const response = await client.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are TripMind, a careful travel-planning assistant.",
              "Create a practical, personalized itinerary as a single JSON object with keys: destination, days, totalEstimatedBudget, summary, foodSuggestions, transportSuggestions, tips, whyThisFits.",
              "days must contain exactly the requested number of objects. Each day object has title, morning, afternoon, evening, estimatedSpend.",
              "CurrentRequest is the user's instruction for this trip and always overrides conflicting saved preferences or older memories.",
              "Use only relevant memories. Never claim live-verified opening hours, prices, availability, or transit facts. Estimates and suggestions must be labelled as such.",
              "Keep estimated spending within the requested budget when one is supplied; say when that cannot reasonably be done.",
              "Include foodSuggestions and transportSuggestions as arrays of short, clearly caveated ideas.",
              "Do not invent personal preferences beyond the data provided. Be concise and specific.",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("The AI returned an empty itinerary.");
      return {
        plan: normalizeItinerary(JSON.parse(content), request, effectiveBudget),
        mode: "ai",
        warning: null,
      };
    },
  };
}

export { buildDemoPlan, normalizeItinerary };
