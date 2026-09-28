import { createHmac } from "node:crypto";
import { HindsightClient, HindsightError } from "@vectorize-io/hindsight-client";

const REQUEST_TIMEOUT_MS = 10000;

export function createHindsightService({ baseUrl, apiKey, signingSecret, client: suppliedClient }) {
  const configured = Boolean(suppliedClient || baseUrl);
  const client = suppliedClient ?? (configured
    ? new HindsightClient({ baseUrl, ...(apiKey ? { apiKey } : {}), maxAttempts: 2 })
    : null);

  function bankIdFor(profileKey) {
    return `tripmind-${createHmac("sha256", signingSecret).update(`bank:${profileKey}`).digest("hex").slice(0, 32)}`;
  }

  async function ensureBank(bankId) {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      await client.getBankConfig(bankId, { signal });
    } catch (error) {
      if (!(error instanceof HindsightError) || error.statusCode !== 404) throw error;
      try {
        await client.createBank(bankId, {
          name: "TripMind traveler",
          mission: "Remember only useful, user-shared travel preferences and experiences for personalized trip planning.",
          disposition: { skepticism: 3, literalism: 4, empathy: 3 },
          signal,
        });
      } catch (createError) {
        if (!(createError instanceof HindsightError) || createError.statusCode !== 409) throw createError;
      }
    }
  }

  return {
    configured,
    async recall(profileKey, query) {
      if (!client) return [];
      const bankId = bankIdFor(profileKey);
      await ensureBank(bankId);
      const response = await client.recall(bankId, query, {
        types: ["world", "observation", "experience"],
        maxTokens: 1800,
        budget: "low",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return (response.results ?? [])
        .map((result) => result.text?.trim())
        .filter(Boolean)
        .slice(0, 8);
    },
    async retain(profileKey, memories) {
      if (!client || memories.length === 0) return;
      const bankId = bankIdFor(profileKey);
      await ensureBank(bankId);
      await client.retainBatch(bankId, memories.map((memory) => ({
        content: memory.text,
        document_id: memory.id,
        context: "User-confirmed long-term travel preference",
        metadata: { category: memory.category },
      })), {
        async: false,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    },
    async clear(profileKey, memories) {
      if (!client || memories.length === 0) return;
      const bankId = bankIdFor(profileKey);
      await ensureBank(bankId);
      for (const memory of memories) {
        try {
          await client.deleteDocument(bankId, memory.id, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
        } catch (error) {
          if (!(error instanceof HindsightError) || error.statusCode !== 404) throw error;
        }
      }
    },
  };
}
