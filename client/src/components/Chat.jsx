import { useEffect, useRef, useState } from 'react'

const GREETING = {
  role: 'assistant',
  content: 'Hi! Tell me what you\'d like to book — e.g. "book me a haircut this Saturday at 3pm".',
}

const STATUS_STYLE = {
  booked: {
    bubble: 'bg-emerald-950 text-emerald-100 border border-emerald-800',
    label: '✓ Booking confirmed',
    labelClass: 'text-emerald-400',
  },
  cancelled: {
    bubble: 'bg-amber-950 text-amber-100 border border-amber-800',
    label: '✕ Appointment cancelled',
    labelClass: 'text-amber-400',
  },
  rescheduled: {
    bubble: 'bg-sky-950 text-sky-100 border border-sky-800',
    label: '↻ Appointment rescheduled',
    labelClass: 'text-sky-400',
  },
}

function Bubble({ role, content, status }) {
  const isUser = role === 'user'
  const statusStyle = !isUser ? STATUS_STYLE[status] : null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : statusStyle
              ? `${statusStyle.bubble} rounded-bl-sm`
              : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
        }`}
      >
        {statusStyle && <div className={`text-xs font-medium mb-1 ${statusStyle.labelClass}`}>{statusStyle.label}</div>}
        {content}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" />
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, status: data.status },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I couldn't reach the server — please try again." },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">BookingAssistant</h1>
          <p className="text-sm text-neutral-500">Chat to book an appointment</p>
        </div>
        <a href="/admin" className="text-sm text-neutral-500 hover:text-neutral-200 transition-colors">
          Admin →
        </a>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} status={m.status} />
          ))}
          {loading && <TypingBubble />}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-neutral-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-xl bg-neutral-900 border border-neutral-700 px-4 py-2.5 text-sm placeholder-neutral-500 focus:outline-none focus:border-emerald-600 max-h-32"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  )
}
