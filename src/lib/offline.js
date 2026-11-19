// Offline backup. If a knock can't reach the database (no signal), it is saved
// on the phone and uploaded automatically later. IDs are created on the phone,
// so uploading the same item twice never makes a duplicate.

const KEY = 'villa-doors-queue-v1'
const listeners = new Set()
let flushing = false

export function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeQueue(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q))
  } catch {
    /* storage full or blocked; nothing else we can do */
  }
  listeners.forEach((fn) => fn(q))
}

export function onQueueChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function enqueue(item) {
  writeQueue([...readQueue(), { ...item, queuedAt: new Date().toISOString(), tries: 0 }])
}

export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /fetch|network|load failed|timed? ?out|offline/i.test(String(err?.message || err || ''))
}

// Item shapes:
//  { type: 'door',  door: {...}, visit: {...} }     brand-new pin
//  { type: 'knock', visit: {...}, patch: {...} }    another knock on an existing pin
// Returns { synced, left, stoppedByNetwork }
export async function flushQueue(supabase) {
  if (flushing) return { synced: 0, left: readQueue().length }
  flushing = true
  let synced = 0
  let stoppedByNetwork = false
  try {
    for (;;) {
      const q = readQueue()
      if (!q.length) break
      const item = q[0]
      const err = await sendItem(supabase, item)
      if (err && isNetworkError(err)) {
        stoppedByNetwork = true
        break
      }
      const rest = readQueue().slice(1)
      if (err) {
        // Unexpected error: never throw the knock away. Keep it, note the
        // problem, and try again on the next sync.
        writeQueue([{ ...item, tries: (item.tries || 0) + 1, lastError: String(err.message || err) }, ...rest])
        break
      }
      writeQueue(rest)
      synced++
    }
  } finally {
    flushing = false
  }
  return { synced, left: readQueue().length, stoppedByNetwork }
}

async function sendItem(supabase, item) {
  if (item.type === 'door') {
    const a = await supabase.from('doors').upsert(item.door, { onConflict: 'id', ignoreDuplicates: true })
    if (a.error) return a.error
    const b = await supabase.from('visits').upsert(item.visit, { onConflict: 'id', ignoreDuplicates: true })
    return b.error
  }
  if (item.type === 'knock') {
    const a = await supabase.from('visits').upsert(item.visit, { onConflict: 'id', ignoreDuplicates: true })
    if (a.error) return a.error
    const b = await supabase.from('doors').update(item.patch).eq('id', item.visit.door_id)
    return b.error
  }
  return null
}
