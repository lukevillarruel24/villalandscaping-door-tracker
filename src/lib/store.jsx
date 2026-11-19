import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'

const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)

export function StoreProvider({ session, children }) {
  const userId = session.user.id
  const [doors, setDoors] = useState([])
  const [contacts, setContacts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onTeam, setOnTeam] = useState(true)
  const [toast, setToast] = useState('')
  const toastTimer = useRef()

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  const loadAll = useCallback(async () => {
    setError('')
    const team = await supabase.from('team_members').select('email').limit(1)
    if (team.error) {
      setError(team.error.message)
      setLoading(false)
      return
    }
    if (!team.data.length) {
      setOnTeam(false)
      setLoading(false)
      return
    }
    setOnTeam(true)
    const [d, c, p] = await Promise.all([
      fetchAll('doors', 'updated_at'),
      fetchAll('contacts', 'created_at'),
      supabase.from('profiles').select('*'),
    ])
    if (d.error || c.error || p.error) {
      setError((d.error || c.error || p.error).message)
    } else {
      setDoors(d.data)
      setContacts(c.data)
      setProfiles(Object.fromEntries(p.data.map((x) => [x.id, x])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Live updates so a pin dropped on one phone shows on the other
  useEffect(() => {
    const ch = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doors' }, (e) =>
        setDoors((list) => applyChange(list, e)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (e) =>
        setContacts((list) => applyChange(list, e)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  // Refresh when the app comes back to the foreground
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && loadAll()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadAll])

  const upsertDoor = useCallback((row) => setDoors((l) => upsertRow(l, row)), [])
  const removeDoor = useCallback((id) => setDoors((l) => l.filter((x) => x.id !== id)), [])
  const upsertContact = useCallback((row) => setContacts((l) => upsertRow(l, row)), [])
  const removeContact = useCallback((id) => setContacts((l) => l.filter((x) => x.id !== id)), [])
  const upsertProfile = useCallback((row) => setProfiles((p) => ({ ...p, [row.id]: row })), [])

  const nameOf = useCallback(
    (id) => {
      if (!id) return 'Someone'
      if (id === userId) return 'You'
      return profiles[id]?.full_name || 'Teammate'
    },
    [profiles, userId],
  )

  const value = useMemo(
    () => ({
      session,
      userId,
      me: profiles[userId],
      doors,
      contacts,
      profiles,
      loading,
      error,
      onTeam,
      toast,
      showToast,
      reload: loadAll,
      upsertDoor,
      removeDoor,
      upsertContact,
      removeContact,
      upsertProfile,
      nameOf,
    }),
    [session, userId, doors, contacts, profiles, loading, error, onTeam, toast, showToast, loadAll,
      upsertDoor, removeDoor, upsertContact, removeContact, upsertProfile, nameOf],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// Supabase returns at most 1000 rows per request, so page through.
export async function fetchAll(table, orderCol, filter) {
  const page = 1000
  let from = 0
  const out = []
  for (;;) {
    let q = supabase.from(table).select('*').order(orderCol, { ascending: false }).range(from, from + page - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) return { data: null, error }
    out.push(...data)
    if (data.length < page) break
    from += page
  }
  return { data: out, error: null }
}

function upsertRow(list, row) {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [row, ...list]
  const copy = list.slice()
  copy[i] = { ...copy[i], ...row }
  return copy
}

function applyChange(list, e) {
  if (e.eventType === 'DELETE') return list.filter((x) => x.id !== e.old.id)
  return upsertRow(list, e.new)
}
