const LONG_TERM_SIGNAL = /\b(i\s+(?:usually|typically|often|always|prefer|love(?:d)?|like(?:d)?|enjoy(?:ed)?|hate(?:d)?|dislike(?:d)?|avoid(?:ed)?)|my\s+(?:usual|typical|preferred)|i(?:'m| am)\s+(?:a\s+)?(?:relaxed|budget|slow|adventure))\b/i;

export function extractUsefulMemories(trip) {
  const memories = [];
  const add = (text, category) => {
    const normalized = text.trim();
    if (normalized && !memories.some((item) => item.text.toLowerCase() === normalized.toLowerCase())) {
      memories.push({ text: normalized, category });
    }
  };

  trip.interests.forEach((interest) => add(`The traveler enjoys ${interest}.`, "likes"));
  trip.dislikes.forEach((dislike) => add(`The traveler dislikes ${dislike}.`, "dislikes"));
  (trip.preferredDestinations ?? []).forEach((destination) => add(`The traveler likes returning to ${destination}.`, "destinations"));
  if (trip.travelStyle) add(`The traveler prefers a ${trip.travelStyle.toLowerCase()} travel style.`, "style");
  if (trip.transportation) add(`The traveler prefers ${trip.transportation.toLowerCase()} for transportation.`, "transportation");
  if (trip.foodPreference) add(`The traveler prefers ${trip.foodPreference.toLowerCase()} food experiences.`, "food");
  if (trip.budget !== null && trip.rememberPreferences) {
    add(`The traveler's typical trip budget is ₹${trip.budget.toLocaleString("en-IN")}.`, "budget");
  }

  const notes = trip.additionalNotes
    .split(/(?<=[.!?])\s+|[\n;]+/)
    .map((item) => item.trim())
    .filter((item) => LONG_TERM_SIGNAL.test(item))
    .slice(0, 5);
  notes.forEach((note) => add(note, "note"));
  return memories.slice(0, 20);
}
