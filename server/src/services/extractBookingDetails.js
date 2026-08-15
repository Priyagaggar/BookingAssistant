const OpenAI = require('openai');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    const options = { apiKey: process.env.OPENAI_API_KEY };
    if (process.env.OPENAI_BASE_URL) {
      options.baseURL = process.env.OPENAI_BASE_URL;
    }
    client = new OpenAI(options);
  }
  return client;
}

// The exact system prompt sent to the LLM. Kept as a plain template string
// (not hidden behind abstraction) so it's easy to copy into a "Prompt
// Design" writeup. `today` is injected so the model can resolve relative
// dates ("this Saturday", "tomorrow") against a fixed reference point, in
// IST — see server/src/services/scheduling.js for why IST is pinned
// explicitly rather than trusting the server's local timezone.
function buildSystemPrompt(today) {
  const todayISO = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA -> YYYY-MM-DD
  const todayWeekday = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });

  return `You are a scheduling assistant for a small business. Read the conversation and determine what the customer wants: to book a new appointment, cancel an existing one, or reschedule an existing one.

Today's date is ${todayISO} (${todayWeekday}). All dates and times are in Indian Standard Time (IST, UTC+5:30) — assume this timezone for every date/time mentioned and do not attempt any timezone conversion yourself.

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

// Structured Outputs JSON schema — the model's reply is constrained to match
// this shape exactly, so we never have to hand-parse free-text JSON.
const BOOKING_EXTRACTION_SCHEMA = {
  name: 'booking_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['book', 'cancel', 'reschedule', 'unclear'],
        description: 'What the customer wants to do.',
      },
      isComplete: {
        type: 'boolean',
        description: 'True only if enough fields are known, per the rules for this intent, with no ambiguity.',
      },
      service: {
        type: ['string', 'null'],
        description: "The requested service, e.g. 'haircut'.",
      },
      date: {
        type: ['string', 'null'],
        description: 'YYYY-MM-DD. For book: the desired date. For cancel/reschedule: the date of the EXISTING appointment, if given.',
      },
      time: {
        type: ['string', 'null'],
        description: '24-hour HH:mm. For book: the desired time. For cancel/reschedule: the time of the EXISTING appointment, if given.',
      },
      name: {
        type: ['string', 'null'],
        description: "The customer's name.",
      },
      newDate: {
        type: ['string', 'null'],
        description: 'YYYY-MM-DD. Reschedule only: the new desired date.',
      },
      newTime: {
        type: ['string', 'null'],
        description: '24-hour HH:mm. Reschedule only: the new desired time.',
      },
      clarifyingQuestion: {
        type: ['string', 'null'],
        description: 'A single friendly question asking for exactly the missing/ambiguous info. Present only when isComplete is false.',
      },
    },
    required: ['intent', 'isComplete', 'service', 'date', 'time', 'name', 'newDate', 'newTime', 'clarifyingQuestion'],
    additionalProperties: false,
  },
};

/**
 * Calls the LLM to extract booking/cancel/reschedule intent from a conversation.
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages - full turn history plus the latest user message
 * @param {Date} now - injected for deterministic date resolution/testing
 */
async function extractBookingDetails(messages, now = new Date()) {
  const openai = getClient();

  const isGroq = process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.includes('groq.com');
  const responseFormat = isGroq 
    ? { type: 'json_object' }
    : { type: 'json_schema', json_schema: BOOKING_EXTRACTION_SCHEMA };

  let systemPrompt = buildSystemPrompt(now);
  if (isGroq) {
    systemPrompt += `\n\nYou MUST return a JSON object matching this schema: ${JSON.stringify(BOOKING_EXTRACTION_SCHEMA.schema)}`;
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    response_format: responseFormat,
  });

  const raw = completion.choices[0].message.content;
  return JSON.parse(raw);
}

module.exports = { extractBookingDetails, buildSystemPrompt, BOOKING_EXTRACTION_SCHEMA };
