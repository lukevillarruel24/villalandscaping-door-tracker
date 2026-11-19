import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { flushQueue, onQueueChange, readQueue } from './offline.js'
import { DEFAULT_DAILY_GOAL } from './constants.js'
import { isDue, startOfDay } from './dates.js'

const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)

export function StoreProvider({ session, children }) {
  const userId = session.user.id
  const [serverDoors, setServerDoors] = useState([])
  const [contacts, setContacts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [settings, setSettings] = useState({})
  const [todayIds, setTodayIds] = useState(() => new Set())
  const [queue, setQueue] = useState(() => readQueue())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onTeam, setOnTeam] = useState(true)
  const [toast, setToast] = useState('')
  const toastTimer = useRef()

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  const loadToday = useCallback(async () => {
    const { data } = await supabase
      .from('visits')
      .select('door_id')
      .eq('created_by', userId)
      .gte('created_at', startOfDay().toISOString())
    if (data) setTodayIds(new Set(data.map((v) => v.door_id)))
  }, [userId])

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
    const [d, c, p, s] = await Promise.all([
      fetchAll('doors', 'updated_at'),
      fetchAll('contacts', 'created_at'),
      supabase.from('profiles').select('*'),
      supabase.from('settings').select('*'),
    ])
    if (d.error || c.error || p.error) {
      setError((d.error || c.error || p.error).message)
    } else {
      setServerDoors(d.data)
      setContacts(c.data)
      setProfiles(Object.fromEntries(p.data.map((x) => [x.id, x])))
    }
    // settings is optional (older databases may not have it yet)
    if (!s.error && s.data) setSettings(Object.fromEntries(s.data.map((x) => [x.key, x.value])))
    await loadToday()
    setLoading(false)
  }, [loadToday])

  // Upload anything saved offline, then refresh
  const syncNow = useCallback(async () => {
    if (!readQueue().length) return
    const r = await flushQueue(supabase)
    if (r.synced > 0) {
      showToast(`${r.synced} saved ${r.synced === 1 ? 'knock' : 'knocks'} uploaded`)
      loadAll()
    }
  }, [loadAll, showToast])

  useEffect(() => {
    syncNow().finally(loadAll)
  }, [])

  useEffect(() => onQueueChange(setQueue), [])

  useEffect(() => {
    const onOnline = () => syncNow()
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => {
      if (readQueue().length && navigator.onLine !== false) syncNow()
    }, 20000)
    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [syncNow])

  // Live updates so a pin dropped on one phone shows on the other
  useEffect(() => {
    const ch = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doors' }, (e) =>
        setServerDoors((list) => applyChange(list, e)),
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
    const onVis = () => {
      if (document.visibilityState === 'visible') syncNow().finally(loadAll)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadAll, syncNow])

  // Doors as the phone should show them: server rows + anything waiting to upload
  const doors = useMemo(() => {
    if (!queue.length) return serverDoors
    const byId = new Map(serverDoors.map((d) => [d.id, d]))
    for (const item of queue) {
      if (item.type === 'door' && !byId.has(item.door.id)) {
        byId.set(item.door.id, { ...item.door, _pending: true })
      } else if (item.type === 'knock' && byId.has(item.visit.door_id)) {
        byId.set(item.visit.door_id, { ...byId.get(item.visit.door_id), ...item.patch, _pending: true })
      }
    }
    return [...byId.values()]
  }, [serverDoors, queue])

  const knockedToday = useMemo(() => {
    const ids = new Set(todayIds)
    const start = startOfDay().getTime()
    for (const item of queue) {
      if (item.visit?.created_by === userId && new Date(item.visit.created_at).getTime() >= start)
        ids.add(item.visit.door_id)
    }
    return ids.size
  }, [todayIds, queue, userId])

  const dailyGoal = Number(settings.daily_goal?.doors) || DEFAULT_DAILY_GOAL

  const due = useMemo(() => {
    const leads = contacts.filter((c) => c.stage === 'lead' && isDue(c.follow_up_at))
    const revisits = doors.filter((d) => d.status === 'come_back' && isDue(d.follow_up_at))
    return { leads, revisits, count: leads.length + revisits.length }
  }, [contacts, doors])

  const upsertDoor = useCallback((row) => setServerDoors((l) => upsertRow(l, row)), [])
  const removeDoor = useCallback((id) => setServerDoors((l) => l.filter((x) => x.id !== id)), [])
  const upsertContact = useCallback((row) => setContacts((l) => upsertRow(l, row)), [])
  const removeContact = useCallback((id) => setContacts((l) => l.filter((x) => x.id !== id)), [])
  const upsertProfile = useCallback((row) => setProfiles((p) => ({ ...p, [row.id]: row })), [])
  const markKnockedToday = useCallback((doorId) => setTodayIds((s) => new Set(s).add(doorId)), [])
  const setSetting = useCallback((key, value) => setSettings((s) => ({ ...s, [key]: value })), [])

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
      settings,
      dailyGoal,
      knockedToday,
      queue,
      due,
      loading,
      error,
      onTeam,
      toast,
      showToast,
      reload: loadAll,
      syncNow,
      upsertDoor,
      removeDoor,
      upsertContact,
      removeContact,
      upsertProfile,
      markKnockedToday,
      setSetting,
      nameOf,
    }),
    [session, userId, doors, contacts, profiles, settings, dailyGoal, knockedToday, queue, due, loading, error,
      onTeam, toast, showToast, loadAll, syncNow, upsertDoor, removeDoor, upsertContact, removeContact,
      upsertProfile, markKnockedToday, setSetting, nameOf],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// Supabase returns at most 1000 rows per request, so page through.
export async function fetchAll(table, orderCol, filter, columns = '*') {
  const page = 1000
  let from = 0
  const out = []
  for (;;) {
    let q = supabase.from(table).select(columns).order(orderCol, { ascending: false }).range(from, from + page - 1)
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
