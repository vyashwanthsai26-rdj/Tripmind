async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("TripMind returned an unexpected response. Please try again.");
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || "TripMind couldn't complete that request.");
  }
  return result.data;
}

export const api = {
  health: () => request("/health"),
  session: () => request("/session"),
  planTrip: (trip) => request("/trip/plan", { method: "POST", body: JSON.stringify(trip) }),
  trips: () => request("/trips"),
  trip: (id) => request(`/trips/${encodeURIComponent(id)}`),
  memory: () => request("/memory"),
  addMemory: (text) => request("/memory", { method: "POST", body: JSON.stringify({ text }) }),
  clearMemory: () => request("/memory", { method: "DELETE" }),
};

export function formatRupees(amount) {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return "Flexible";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function friendlyDate(value) {
  if (!value) return "Recently planned";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Recently planned"
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
