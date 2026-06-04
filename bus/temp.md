# Rejseplanen API — Chatbot Briefing Guide

Use this document to brief any AI assistant on the project setup and the API endpoints needed to build or extend the departure board at `pedropapp.me/bus`.

---

## Project context

- **Site:** `pedropapp.me` (GitHub Pages, static files only)
- **Page:** `pedropapp.me/bus` — shows live bus/train departures from a user-entered address
- **Files:**
  - `bus/index.html` — HTML structure only
  - `bus/bus.css` — all styles
  - `bus/bus.js` — all logic; calls the proxy, no API key in the browser
- **Proxy:** Cloudflare Worker at `https://rejseplanen-proxy.pedropapp15.workers.dev`
  - Holds the API key server-side
  - Adds CORS headers
  - Allowed origins: `https://pedropapp.me`, `http://127.0.0.1:5501`, `http://localhost:5501`
- **API key:** `0b621188-b669-4a2d-9e60-4da572d1c134` (only lives in the Worker, never in browser JS)

---

## How the proxy works

All API calls go through the Worker, not directly to Rejseplanen. In `bus.js`:

```js
const PROXY = 'https://rejseplanen-proxy.pedropapp15.workers.dev';
```

Calls are made like this:

```js
const url = new URL(PROXY + '/location.name');
url.searchParams.set('input', 'Vesterbrogade 12');
url.searchParams.set('maxNo', 1);
const res = await fetch(url.toString());
```

The Worker appends `accessId` and `format=json` automatically — **never include them in `bus.js`**.

---

## The three endpoints used in this project

### 1. `location.name` — resolve an address to coordinates

Turns a typed address string into lat/lon so we can find nearby stops.

```
GET /location.name?input=QUERY&type=A&maxNo=1
```

| Param | Value | Notes |
|-------|-------|-------|
| `input` | e.g. `Vesterbrogade 12, København` | The typed address |
| `type` | `A` | Address only (use `S` for stops, `ALL` for both) |
| `maxNo` | `1` | We only need the top result |

**Response shape:**
```json
{
  "LocationList": {
    "CoordLocation": {
      "name": "Vesterbrogade 12, København",
      "lat": "55.673",
      "lon": "12.561"
    }
  }
}
```

`CoordLocation` = address result. `StopLocation` = stop result. Either may be an object or an array — always normalise with `Array.isArray()`.

---

### 2. `location.nearbystops` — find stops near a coordinate

Returns up to N stops within 1000m, ordered by distance.

```
GET /location.nearbystops?originCoordLat=LAT&originCoordLong=LON&maxNo=5
```

| Param | Value | Notes |
|-------|-------|-------|
| `originCoordLat` | e.g. `55.673` | From step 1 |
| `originCoordLong` | e.g. `12.561` | From step 1 |
| `maxNo` | `5` | How many nearby stops to return |

**Response shape:**
```json
{
  "LocationList": {
    "StopLocation": [
      { "id": "8600626", "name": "Vesterbro Torv", "lat": "55.672", "lon": "12.559", "dist": "143" }
    ]
  }
}
```

`dist` is distance in metres. `id` is what you pass to `departureBoard`.

---

### 3. `departureBoard` — live departures for a stop

Returns the next departures from a stop, including realtime data if available.

```
GET /departureBoard?id=STOP_ID&maxJourneys=6
```

| Param | Value | Notes |
|-------|-------|-------|
| `id` | e.g. `8600626` | Stop ID from step 2 |
| `maxJourneys` | `6` | Departures to return per stop |

**Response shape:**
```json
{
  "DepartureBoard": {
    "Departure": [
      {
        "name": "Bus 6A",
        "direction": "Buddinge",
        "date": "13.05.26",
        "time": "14:35",
        "rtDate": "13.05.26",
        "rtTime": "14:37",
        "cancelled": "false"
      }
    ]
  }
}
```

| Field | Meaning |
|-------|---------|
| `name` | Line name, e.g. `Bus 6A`, `S-tog A`, `M1` |
| `direction` | Final destination of the service |
| `date` / `time` | Scheduled departure — format `DD.MM.YY` / `HH:MM` |
| `rtDate` / `rtTime` | Realtime departure (only present if different or tracked) |
| `cancelled` | `"true"` if cancelled — filter these out |

**Parsing the date format:**
```js
function parseRPTime(dateStr, timeStr) {
  const [d, m, y] = dateStr.split('.');
  const [h, min]  = timeStr.split(':');
  const year = parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y);
  return new Date(year, parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min), 0);
}
```

---

## Other available endpoints (not yet used)

These exist on the same API and may be useful for future features:

| Endpoint | What it does |
|----------|--------------|
| `trip` | Full journey planner — origin to destination with transfers |
| `arrivalBoard` | Arrivals at a stop instead of departures |
| `multiDepartureBoard` | Departure boards for several stops in one call |
| `journeyDetail` | Full stop list and realtime status for a specific service |
| `nearbyDepartureBoard` | Departures near a coordinate without needing stop IDs first |
| `location.search` | Combined address + stop search |
| `himsearch` | Service disruptions and planned engineering works |

---

## "Leave now" logic

The core feature — when to leave the house:

```js
const minsToDepart = Math.round((realtimeDeparture - now) / 60000);
const minsToLeave  = minsToDepart - walkMinutes; // walkMinutes set by slider (default 5)

if (minsToLeave <= 0 && minsToDepart >= 0) {
  // LEAVE NOW
} else if (minsToLeave <= 3) {
  // leave in X min (warning)
} else {
  // in X min (normal)
}
```

---

## How to help a chatbot understand this faster

If you're starting a new conversation and need a chatbot to help extend this project, paste this entire document and add:

> "I have a live departure board page. The files are `index.html`, `bus.css`, and `bus.js`. All API calls go through a Cloudflare Worker proxy — never call Rejseplanen directly from the browser. The Worker adds the API key. Please read the guide above before writing any code."

Then attach or paste whichever file you want to modify.

---

## Common mistakes to avoid

- **Never add `accessId` or `format=json` in `bus.js`** — the Worker adds them
- **Never call `xmlopen.rejseplanen.dk` directly** — always use `PROXY + '/endpoint'`
- **Always handle both object and array** in API responses — a single result comes back as an object, multiple as an array
- **Use `rtDate`/`rtTime` when present** for the displayed time, fall back to `date`/`time`
- **Filter out `cancelled: "true"`** departures before rendering

add run feature. for example, 
if the distance is set to 5 minutes, and the bus is 4 mins away it should say run. if its 2 it should already say too far. you can add a running distance slider to the mix as well.
 fix fonts and styling so they are not serifed. it should look like an old train dashboard, with flipping tiles and such
 the buses should go from left to right on the bar and they are too opaque once they pass

