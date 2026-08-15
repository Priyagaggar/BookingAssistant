import { useEffect, useState } from 'react'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function StatusBadge({ status }) {
  const isBooked = status === 'booked'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isBooked ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
      }`}
    >
      {status}
    </span>
  )
}

export default function Admin() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/appointments')
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json()
      setAppointments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function cancelAppointment(id) {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const updated = await res.json()
      setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
    } catch (err) {
      setError(`Failed to cancel appointment: ${err.message}`)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin</h1>
          <p className="text-sm text-neutral-500">All appointments</p>
        </div>
        <a href="/" className="text-sm text-neutral-500 hover:text-neutral-200 transition-colors">
          ← Back to chat
        </a>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 text-red-200 text-sm px-4 py-2.5">{error}</div>
        )}

        {loading ? (
          <p className="text-neutral-500 text-sm">Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p className="text-neutral-500 text-sm">No appointments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a._id} className="border-b border-neutral-900 last:border-0">
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3">{a.service}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(a.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatTime(a.time)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'booked' && (
                        <button
                          onClick={() => cancelAppointment(a._id)}
                          disabled={cancellingId === a._id}
                          className="rounded-lg border border-neutral-700 hover:border-red-700 hover:text-red-400 disabled:opacity-50 text-neutral-300 text-xs font-medium px-3 py-1.5 transition-colors"
                        >
                          {cancellingId === a._id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
