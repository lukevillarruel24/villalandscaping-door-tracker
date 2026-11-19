import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { PageHeader } from './ui.jsx'

export default function Account() {
  const { session, me, profiles, upsertProfile, showToast, userId } = useStore()
  const [name, setName] = useState(me?.full_name || '')
  const [pw, setPw] = useState('')
  const [team, setTeam] = useState([])

  useEffect(() => setName(me?.full_name || ''), [me?.full_name])
  useEffect(() => {
    supabase
      .from('team_members')
      .select('email')
      .order('email')
      .then(({ data }) => setTeam(data || []))
  }, [])

  async function saveName(e) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', userId)
      .select()
      .single()
    if (error) return showToast(error.message)
    upsertProfile(data)
    showToast('Name saved')
  }

  async function savePw(e) {
    e.preventDefault()
    if (pw.length < 8) return showToast('Use at least 8 characters')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return showToast(error.message)
    setPw('')
    showToast('Password changed')
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone

  return (
    <div className="page">
      <PageHeader title="Me" sub={session.user.email} />
      <div className="page-body stack">
        <form className="card pad stack-sm" onSubmit={saveName}>
          <label className="field">
            <span>Your name (shown on pins and stats)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn primary" disabled={!name.trim() || name === (me?.full_name || '')}>
            Save name
          </button>
        </form>

        <form className="card pad stack-sm" onSubmit={savePw}>
          <label className="field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <button className="btn" disabled={!pw}>
            Change password
          </button>
        </form>

        {!standalone && (
          <div className="card pad">
            <b>Put this app on your home screen</b>
            <p className="small">
              {isIOS
                ? 'In Safari, tap the Share button, then "Add to Home Screen".'
                : 'In Chrome, tap the ⋮ menu, then "Add to Home screen" or "Install app".'}{' '}
              It opens full screen like a normal app.
            </p>
          </div>
        )}

        <div className="card pad">
          <b>Team</b>
          <ul className="team-list">
            {team.map((t) => {
              const p = Object.values(profiles).find((x) => x.email?.toLowerCase() === t.email.toLowerCase())
              return (
                <li key={t.email}>
                  {p?.full_name ? <b>{p.full_name}</b> : <span className="muted">Not signed in yet</span>}
                  <span className="small muted"> {t.email}</span>
                </li>
              )
            })}
          </ul>
          <p className="tiny muted">Add people in Supabase (see the setup guide in the README).</p>
        </div>

        <button className="btn block" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
