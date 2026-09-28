const MAX_TEXT_LENGTH = 500;
const SENSITIVE_TEXT = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\+?\d[\d\s().-]{8,}\d|\b(?:passport|password|credit card|debit card|bank account|home address|phone number)\b/i;

function hasSensitiveText(values) {
  return values.some((value) => typeof value === "string" && SENSITIVE_TEXT.test(value));
}

function cleanText(value, maxLength = 80) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validOptionalText(value, maxLength) {
  return value === undefined || value === null
    || (typeof value === "string" && value.length <= maxLength);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => cleanText(item, 60))
    .filter(Boolean))].slice(0, 12);
}

export function validateTripRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Enter your trip details to continue." };
  }
  if (hasSensitiveText([
    input.destination,
    input.foodPreference,
    input.additionalNotes,
    ...(Array.isArray(input.preferredDestinations) ? input.preferredDestinations : []),
  ])) {
    return { error: "Please remove contact, account, or identity details. TripMind only needs travel preferences." };
  }
  if (!validOptionalText(input.destination, 80)
      || !validOptionalText(input.travelStyle, 80)
      || !validOptionalText(input.transportation, 80)
      || !validOptionalText(input.foodPreference, 80)
      || !validOptionalText(input.additionalNotes, MAX_TEXT_LENGTH)) {
    return { error: "One or more text fields are too long or have an invalid format." };
  }
  for (const field of ["interests", "dislikes", "preferredDestinations"]) {
    const values = input[field];
    if (values !== undefined && values !== null
        && (!Array.isArray(values) || values.length > 12
          || values.some((item) => typeof item !== "string" || item.trim().length > 60))) {
      return { error: "Choose up to 12 valid preferences in each list." };
    }
  }

  const destination = cleanText(input.destination, 80);
  const validDays = typeof input.days === "number"
    || (typeof input.days === "string" && input.days.trim() !== "");
  const days = validDays ? Number(input.days) : Number.NaN;
  if (!validDays) return { error: "Enter a valid number of trip days." };
  const validBudget = typeof input.budget === "number"
    || (typeof input.budget === "string" && input.budget.trim() !== "");
  if (input.budget !== "" && input.budget !== null && input.budget !== undefined && !validBudget) {
    return { error: "Enter a valid trip budget." };
  }
  const budget = input.budget === "" || input.budget === null || input.budget === undefined
    ? null
    : Number(input.budget);

  if (!Number.isInteger(days) || days < 1 || days > 21) {
    return { error: "Choose a trip length between 1 and 21 days." };
  }
  if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 10000000)) {
    return { error: "Enter a valid budget up to ₹1,00,00,000, or leave it blank." };
  }
  if (input.rememberPreferences !== undefined && typeof input.rememberPreferences !== "boolean") {
    return { error: "Choose whether TripMind should remember these preferences." };
  }

  return {
    value: {
      destination,
      days,
      budget,
      interests: cleanList(input.interests),
      dislikes: cleanList(input.dislikes),
      preferredDestinations: cleanList(input.preferredDestinations),
      travelStyle: cleanText(input.travelStyle, 80),
      transportation: cleanText(input.transportation, 80),
      foodPreference: cleanText(input.foodPreference, 80),
      additionalNotes: cleanText(input.additionalNotes, MAX_TEXT_LENGTH),
      rememberPreferences: input.rememberPreferences !== false,
    },
  };
}

export function validateMemoryText(input) {
  if (typeof input?.text !== "string" || input.text.length > MAX_TEXT_LENGTH) {
    return { error: "Travel memory notes must be 500 characters or fewer." };
  }
  const text = cleanText(input.text, MAX_TEXT_LENGTH);
  if (!text) return { error: "Write a travel preference you'd like TripMind to remember." };
  if (SENSITIVE_TEXT.test(text)) {
    return { error: "Please remove contact, account, or identity details from travel memory." };
  }
  return { value: text };
}
