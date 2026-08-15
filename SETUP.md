# BookingAssistant — Technical Run Guide

This is a working-notes README for running the project locally. It's separate from the root `README.md`, which is reserved for the submission writeup.

## Stack

- **Server**: Node.js + Express + Mongoose (MongoDB), OpenAI for chat-based booking extraction
- **Client**: React (Vite) + Tailwind CSS, no router library (two pages, plain pathname check)

## Prerequisites

- Node.js 18+ (built and tested on Node 22)
- A MongoDB connection string — either a local `mongod` instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- An OpenAI API key with access to a Structured Outputs–capable model (default: `gpt-4o-mini`)

## 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## 2. Configure environment variables

```bash
cd server
cp .env.example .env
```

Then edit `server/.env`:

| Variable         | Required | Description                                                              |
|------------------|----------|---------------------------------------------------------------------------|
| `MONGO_URI`      | Yes*     | MongoDB connection string. *The server still starts without it (logs a warning) but bookings can't be saved/read. |
| `PORT`           | No       | Backend port. Defaults to `5000`.                                        |
| `OPENAI_API_KEY` | Yes*     | Needed for `POST /api/chat` to actually extract booking details. *Without it, the route responds with a graceful fallback error instead of crashing. |
| `OPENAI_MODEL`   | No       | Defaults to `gpt-4o-mini`. Must support Structured Outputs (`response_format: json_schema`). |

The client has no `.env` of its own — its dev server proxies `/api/*` requests to `http://localhost:5000` (see `client/vite.config.js`).

## 3. Run both servers

In two separate terminals:

```bash
# Terminal 1 — backend, http://localhost:5000
cd server
npm run dev      # nodemon, restarts on file changes
# or: npm start   # plain node, no auto-restart

# Terminal 2 — frontend, http://localhost:5173
cd client
npm run dev
```

Open the app:
- Chat: `http://localhost:5173/`
- Admin panel: `http://localhost:5173/admin`

## Project layout

```
server/
  src/
    index.js                       # Express app entry point
    db.js                          # Mongoose connection
    models/Appointment.js          # Appointment schema
    routes/
      chat.js                      # POST /api/chat
      appointments.js              # GET /api/appointments, PATCH /api/appointments/:id
    services/
      extractBookingDetails.js     # OpenAI call + system prompt + JSON schema
      bookingChat.js                # book/cancel/reschedule business logic
      scheduling.js                 # IST + business-hours helpers, conflict detection
client/
  src/
    App.jsx                        # routes "/" -> Chat, "/admin" -> Admin
    components/
      Chat.jsx
      Admin.jsx
```

## Assumptions baked into the code

These aren't specified anywhere else in the project, so they're worth knowing before you demo or extend this:

- **Timezone**: every date/time is treated as IST (UTC+5:30), regardless of the server's own system timezone. See `server/src/services/scheduling.js`.
- **Business hours**: used only to judge "is this day fully booked" when suggesting alternative times. Hardcoded as hourly slots, 9am–5pm start times, in `BUSINESS_HOURS` in `scheduling.js`. Change that array if the real hours differ.
- **No authentication**: the admin panel at `/admin` has no login — anyone with the URL can view and cancel appointments. Fine for local/demo use; would need real auth before any public deployment.
- **No booking edit via admin**: the admin panel can only cancel; rescheduling happens through the chat only.

## Troubleshooting

- **"MongoDB connection error" on startup**: the server still starts and `/api/hello` still works, but anything touching `Appointment` (booking, admin list) will fail until `MONGO_URI` is set correctly.
- **`/api/chat` returns "Something went wrong on my end"**: almost always a missing/invalid `OPENAI_API_KEY`, or a model name in `OPENAI_MODEL` that doesn't support Structured Outputs. Check the server's terminal output for the underlying error.
- **Admin page loads but the table never appears**: check the browser console/network tab for a failed `GET /api/appointments` — usually the same MongoDB connection issue above.
