# TripMind

**Your AI travel planner that remembers how you travel.**

TripMind plans trips around a traveler's current request and, with permission, their saved preferences and past experiences. Structured trip data belongs in MongoDB; long-term semantic travel memory belongs in Hindsight; itinerary generation belongs in the server-side LLM service.

## Features

- Responsive home, trip planner, trip history, travel memory, and settings screens.
- Server-validated trip requests and saved, user-scoped itineraries.
- Preference capture for interests, dislikes, travel style, transportation, food, and typical budget.
- Hindsight `retain` and `recall` through Vectorize's official TypeScript SDK, with one derived memory bank per browser profile.
- OpenAI itinerary generation through the official server-side SDK.
- Honest demo mode when MongoDB, Hindsight, or an LLM credential is not configured.
- Local JSON persistence in demo mode; MongoDB is used when `MONGODB_URI` is configured.
- Explicit memory clearing, friendly error states, and automated backend tests.

## Architecture

```text
React + Vite
    | same-origin /api requests
Express API
    |-- MongoDB/Mongoose (configured) or local demo store (unconfigured)
    |-- Hindsight TypeScript SDK (optional, per-profile memory bank)
    `-- OpenAI SDK (optional; clearly labelled sample plan otherwise)
```

MongoDB stores structured profiles and trips. Hindsight stores semantic long-term memory and is not a substitute for the trip database. The server creates a random signed, HTTP-only browser-profile cookie; clients cannot choose another profile ID. The initial project intentionally has no account registration or cross-device login. Anyone with access to the same browser profile can use its data, so add real authentication before exposing this version publicly.

## Requirements

- Node.js 20 or newer and npm.
- A MongoDB deployment for shared/production persistence (optional for the local demo).
- An OpenAI API key for live AI plans (optional for the local demo).
- A reachable Hindsight server for semantic memory (optional for the local demo).

## Setup

1. Copy `.env.example` to `.env` in the project root.
2. Set a private, persistent `SESSION_SECRET` (at least 32 random characters). Never commit `.env`.
3. Optionally configure the MongoDB, OpenAI, and Hindsight variables described below.
4. Install dependencies and run the app:

   ```sh
   npm install
   npm run dev
   ```

5. Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

The client proxies `/api` to Express on port `3001`. For a production build, run `npm run build`, then `npm start`; Express serves the built client.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Express port; defaults to `3001`. |
| `NODE_ENV` | No | Use `production` for deployment. |
| `SESSION_SECRET` | Required for durable/production use | Signs the HTTP-only browser-profile cookie. In development only, a temporary random value is generated if omitted. |
| `MONGODB_URI` | No for demo; recommended otherwise | MongoDB connection string. A configured but unreachable database is an error, not a silent fallback. |
| `OPENAI_API_KEY` | No for demo; required for live plans | Server-side OpenAI API credential. Never expose it through Vite variables. |
| `OPENAI_MODEL` | No | Model name; defaults to `gpt-4o-mini`. |
| `HINDSIGHT_BASE_URL` | No for demo; required for live memory | Base URL of a Hindsight API, such as `http://localhost:8888`. |
| `HINDSIGHT_API_KEY` | No | Optional API key supported by the official Hindsight TypeScript client. |

Without `MONGODB_URI`, trips and structured preferences are stored in `server/.data/tripmind.json`. Without `OPENAI_API_KEY`, a visibly labelled sample itinerary is produced. Without Hindsight, TripMind still saves and uses structured preferences, but semantic memory is unavailable. These fallbacks make the project demonstrable; they are not production substitutes for the services.

## MongoDB

Create a database in MongoDB Atlas or run a local MongoDB server, copy its connection URI to `MONGODB_URI`, and allow your development IP in Atlas if needed. TripMind creates indexes for profile keys and trip history when the server connects. A configured database that cannot connect causes the server to stop with an explicit error.

## LLM

Create an OpenAI API key, set `OPENAI_API_KEY` in the root `.env`, and optionally choose `OPENAI_MODEL`. Calls happen only on the Express server. Generated schedules are suggestions, not verified opening hours, fares, or availability; verify details before travel.

## Hindsight

TripMind uses Vectorize's official `@vectorize-io/hindsight-client` Node.js/TypeScript SDK. The server constructs `HindsightClient` with `baseUrl` and optional `apiKey`, creates a per-profile bank, retains only explicitly saved travel preferences, and recalls a small relevant result set while planning. The browser never receives Hindsight credentials or bank identifiers.

Run Hindsight using its current official deployment instructions. For example, the official documentation describes a Docker deployment on port `8888`; configure the Hindsight service's own LLM provider credentials on that service if its retain pipeline requires them. The TripMind API's `HINDSIGHT_BASE_URL` points to that server. Consult the [Hindsight Node.js SDK documentation](https://hindsight.vectorize.io/sdks/nodejs) and [Hindsight API documentation](https://hindsight.vectorize.io/api-reference) for version-specific behavior.

## Project structure

```text
client/
  src/
    components/       Shared navigation, cards, and states
    pages/            Home, planner, trips, memory, settings
    services/         Same-origin API client
    styles/           Responsive application styles
    App.jsx
    main.jsx
server/
  src/
    middleware/       Signed browser profile, errors
    models/           Mongoose profile and trip models
    routes/           REST endpoints
    services/         AI, Hindsight, planning, persistence
    utils/            Validation and memory extraction
    app.js
    server.js
  test/               API and service tests
.env.example
```

## API

All endpoints return `{ "success": true, "data": ... }` or a consistent error envelope.

- `GET /api/health`
- `GET /api/session`
- `POST /api/trip/plan`
- `GET /api/trips`
- `GET /api/trips/:id`
- `GET /api/memory`
- `POST /api/memory`
- `DELETE /api/memory`

The browser-profile cookie is HTTP-only, `SameSite=Lax`, and secure in production. The API never trusts a client-supplied user ID. This is profile isolation, not authentication: configure a stable secret, protect the browser, and add account authentication before a public multi-user deployment.

## Memory demo

1. Open **Plan a trip**, add preferences such as quiet destinations, a relaxed pace, and a food preference.
2. Keep **Remember these preferences for future trips** enabled and generate a plan.
3. Open **Travel memory** to see what was saved.
4. Plan again; TripMind recalls applicable Hindsight memories when configured, otherwise it uses that profile's structured preferences.
5. Open **Settings** to clear saved travel memory. Saved trip history remains available.

Only explicitly saved travel preferences and manually added memory notes are retained. A one-time greeting or trip-only request is not promoted to long-term memory. A current trip request takes priority over older preferences.

## Testing

```sh
npm test
npm run build
```

Tests cover request validation, memory filtering, the planning API, service failure fallbacks, and profile-scoped trip retrieval. They use injected in-memory services and do not require external credentials. Run with Node.js 20+.

## Future improvements

- User accounts, password recovery, and multi-device synchronization.
- Browser-driven visual and accessibility tests at common viewport widths.
- More LLM providers and provider-specific structured-output validation.
- Verified travel inventory and live transit/availability sources.
- CI, deployment automation, and production monitoring.
