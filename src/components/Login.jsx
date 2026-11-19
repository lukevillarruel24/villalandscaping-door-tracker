import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function signIn(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  async function forgot() {
    if (!email.trim()) {
      setErr('Type your email first, then tap "Forgot password".')
      return
    }
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (error) setErr(error.message)
    else setMsg('Check your email for a link to set a new password.')
  }

  return (
    <div className="center-page login-page">
      <form className="card narrow" onSubmit={signIn}>
        <div className="login-brand">
          <img src="/icon.svg" alt="" width="56" height="56" />
          <div>
            <h1>Villa Doors</h1>
            <p className="muted">Villa Landscaping lead tracker</p>
          </div>
        </div>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="form-error">{err}</p>}
        {msg && <p className="form-ok">{msg}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn link block" onClick={forgot} disabled={busy}>
          Forgot password
        </button>
      </form>
    </div>
  )
}

export function SetNewPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (pw.length < 8) {
      setErr('Use at least 8 characters.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }

  return (
    <div className="center-page login-page">
      <form className="card narrow" onSubmit={save}>
        <h2>Set a new password</h2>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="form-error">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          Save password
        </button>
      </form>
    </div>
  )
}
