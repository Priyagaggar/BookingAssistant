# BookingAssistant — Submission

## Part 1: Problem Understanding

Booking an appointment is usually a simple task, but the process can become inconvenient when users have to fill out forms, select multiple fields, or go through several steps just to find a suitable time. It can also be difficult to handle changes later, such as cancelling an appointment, rescheduling it, or finding out that the requested time is already occupied.
This project aims to make appointment booking more natural and easier by allowing users to interact with a chat-based assistant instead of filling out a traditional booking form. A customer can simply describe what they want in normal language, such as wanting to book a particular service on a certain day and time. If some important information is missing or unclear, the assistant asks a simple follow-up question instead of making assumptions. The user can also cancel or reschedule an existing appointment through the same conversation.
There is also a separate admin flow for managing the appointments. An administrator can view the bookings in one place and manage them when required. The system also checks whether a requested slot is already booked, helping avoid double bookings.

Overall, the goal of the project is to make appointment management feel more like a normal conversation while keeping the booking process organized and reliable for both customers and administrators.

---

## Part 2: Spec & Plan

### System Design (High-Level)
- **Client**: React (Vite) app with two views — a chat interface for customers and an admin table for managing bookings.
- **Server**: Node.js + Express, exposing `/api/chat` (conversational booking) and `/api/appointments` (admin CRUD).
- **Database**: MongoDB via Mongoose, single `Appointment` collection.
- **LLM**: OpenAI `gpt-4o-mini`, called from `extractBookingDetails.js` using Structured Outputs (`response_format: json_schema`) so replies are always valid JSON matching a fixed schema, no manual parsing of free text.
- **Flow**: user message → LLM extracts intent + fields → server validates (past date? conflict? ambiguous match?) → server persists to MongoDB → conversational reply sent back.

### Feature Breakdown
- Book an appointment via natural language chat
- Cancel an appointment via chat ("cancel my haircut for Priya")
- Reschedule an appointment via chat (move an existing booking to a new date/time)
- Clarifying questions when info is missing or ambiguous, asked one at a time
- Admin table: view all appointments, cancel any of them
- Conflict detection: won't double-book a slot, tells the user what's open instead
- All times handled in IST regardless of server timezone

### Prompt Design
The system prompt (in `extractBookingDetails.js`) is injected with the current date/weekday in IST so the model can resolve relative dates like "tomorrow" or "next Friday" against a fixed reference point. Key design choices:
- Model must return one of four intents: `book`, `cancel`, `reschedule`, `unclear`
- Vague time words ("morning", "evening") are explicitly *not* treated as a specific time, the model must ask instead of guessing
- `isComplete` flag gates whether the server proceeds or asks a clarifying question
- Output is constrained by a strict JSON schema (`BOOKING_EXTRACTION_SCHEMA`), so the server never has to hand-parse the model's text

```js
function buildSystemPrompt(today) {
  const todayISO = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA -> YYYY-MM-DD
  const todayWeekday = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });

  return `You are a scheduling assistant for a small business. Read the conversation and determine what the customer wants: to book a new appointment, cancel an existing one, or reschedule an existing one.

Today's date is \${todayISO} (\${todayWeekday}). All dates and times are in Indian Standard Time (IST, UTC+5:30) — assume this timezone for every date/time mentioned and do not attempt any timezone conversion yourself.

Resolve relative dates against today:
- "tomorrow" = the day after today.
- "next <weekday>" = treat this as at least 7 days out, even if that weekday also occurs earlier this week (e.g. if today is Monday, "next Friday" means the Friday 11 days away, not the one 4 days away — the user would say "this Friday" for the closer one).
- Vague time-of-day words alone ("morning", "afternoon", "evening", "night") are NOT a specific time. Do not guess a clock time for them — treat the time as still missing and ask for a specific one.

Return an "intent" of "book", "cancel", "reschedule", or "unclear".

For "book": extract service, date, time, and name. Set isComplete=true only once all four are unambiguous.

For "cancel": extract whichever of name, date, time, service the customer gives to help find their existing appointment — name alone is often enough. Set isComplete=true once you have at least the customer's name.

For "reschedule": extract name/date/time identifying the EXISTING appointment if given, plus newDate and newTime for the desired new slot. Set isComplete=true once you have the name and both newDate and newTime.

For "unclear" (the message isn't clearly a booking, cancellation, or reschedule request): isComplete=false, and ask what they'd like to do.

Whenever isComplete is false, set clarifyingQuestion to one short, friendly question asking for exactly what's missing. Never guess or invent values, and never ask the user to repeat information they already gave earlier in the conversation. If multiple things are missing, ask for only one at a time.`;
}
```

### Data Model
```js
Appointment {
  name: String, required
  service: String, required
  date: Date, required        // stored as midnight IST for that calendar day
  time: String, required      // "HH:mm", kept separate from date to avoid tz ambiguity
  status: 'booked' | 'cancelled', default 'booked'
  createdAt: Date, default now
}
```

### Implementation Plan
1. Scaffold Express + MongoDB + React
2. Define Appointment schema
3. Build `/api/chat` with LLM-based extraction
4. Build validation/persistence logic (booking, cancelling, rescheduling)
5. Build admin CRUD routes and table UI
6. Add conflict detection and edge case handling
7. Test end-to-end, write docs, record demo

---

## Part 3: Implementation

**Model used:** Groq `llama-3.1-8b-instant` (with fallbacks for OpenAI `gpt-4o-mini`)

**Why:** This is a narrow, well-defined extraction task (pull intent/service/date/time/name out of a sentence), not a task needing a large reasoning model. We configured an OpenAI-compatible client configuration to support both OpenAI and Groq. Using Groq's `llama-3.1-8b-instant` provides extremely low latency and is cost-free/highly cost-efficient. We use JSON mode to structure responses reliably.

**Tokens used:** Approx. 1,000–1,500 tokens per full booking/cancellation flow; total testing used ~15,000 tokens.

**Key implementation details:**
- `now` and `extract` are both injectable parameters in `handleChatMessage`, so the whole flow can be unit tested without a real API call or wall-clock dependency
- Timezone handled explicitly throughout (`scheduling.js`), every date is pinned to IST regardless of what timezone the server process runs in, avoiding the classic "date stored one day off" bug

---

## Part 4: Edge Cases

| Edge case | How it's handled |
|---|---|
| Double booking | `describeConflict()` checks existing bookings for that date/time before creating; if taken, tells the user which other times that day are free, or that the whole day is full |
| Ambiguous relative dates | Prompt explicitly resolves "next Friday" vs "this Friday" against today's date; vague time-of-day words ("morning") are treated as missing, not guessed |
| Cancel via chat | Matches the existing appointment by whichever fields were given (name/date/time/service); if more than one match, asks the user to narrow it down; if none found, says so |
| Reschedule via chat | Same matching logic as cancel, plus conflict-checks the *new* slot before moving it, and excludes the appointment's own slot from that conflict check |
| Past date/time requested | Rejected before booking or rescheduling, with a message asking for a different time |
| No slots available that day | Reported clearly instead of a generic error |
| Missing info | Server asks one clarifying question at a time instead of guessing or asking for everything at once |
