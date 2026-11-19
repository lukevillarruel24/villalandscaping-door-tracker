import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase.js'
import { StoreProvider, useStore } from './lib/store.jsx'
import Login, { SetNewPassword } from './components/Login.jsx'
import NavBar from './components/NavBar.jsx'
import MapView from './components/MapView.jsx'
import ContactList from './components/ContactList.jsx'
import ContactDetail from './components/ContactDetail.jsx'
import ContactForm from './components/ContactForm.jsx'
import EstimateEditor from './components/EstimateEditor.jsx'
import EstimatePrint from './components/EstimatePrint.jsx'
import Stats from './components/Stats.jsx'
import Account from './components/Account.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <NotConfigured />
  if (session === undefined) return <Splash />
  if (recovering && session) return <SetNewPassword onDone={() => setRecovering(false)} />
  if (!session) return <Login />

  return (
    <StoreProvider session={session}>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { loading, onTeam, error, toast, reload } = useStore()
  const loc = useLocation()
  const isPrint = loc.pathname.endsWith('/print')

  if (loading) return <Splash />
  if (!onTeam) return <NotOnTeam />

  return (
    <div className={isPrint ? 'app print-mode' : 'app'}>
      {error && (
        <div className="error-bar" onClick={reload}>
          Couldn't load data: {error}. Tap to retry.
        </div>
      )}
      <main className="main">
        <Routes>
          <Route path="/" element={<MapView />} />
          <Route path="/leads" element={<ContactList stage="lead" />} />
          <Route path="/clients" element={<ContactList stage="client" />} />
          <Route path="/contacts/new" element={<ContactForm />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/contacts/:id/edit" element={<ContactForm />} />
          <Route path="/estimates/:id" element={<EstimateEditor />} />
          <Route path="/estimates/:id/print" element={<EstimatePrint />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isPrint && <NavBar />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Splash() {
  return (
    <div className="splash">
      <img src="/icon.svg" alt="" width="72" height="72" />
      <div className="spinner" />
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="center-page">
      <div className="card narrow">
        <h2>Almost there</h2>
        <p>
          This app isn't connected to its database yet. Add your Supabase Project URL and anon key
          in <code>src/config.js</code> (or as Vercel environment variables), then redeploy.
        </p>
      </div>
    </div>
  )
}

function NotOnTeam() {
  const { session } = useStore()
  return (
    <div className="center-page">
      <div className="card narrow">
        <h2>Not on the team list</h2>
        <p>
          You're signed in as <b>{session.user.email}</b>, but that email isn't on the team list yet.
          Ask Luke to add it, then reopen the app.
        </p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
