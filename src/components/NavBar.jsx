import { NavLink } from 'react-router-dom'
import { Icon } from './Icon.jsx'
import { useStore } from '../lib/store.jsx'

const TABS = [
  { to: '/', label: 'Map', icon: 'map', end: true },
  { to: '/leads', label: 'Leads', icon: 'star', badge: true },
  { to: '/clients', label: 'Clients', icon: 'briefcase' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
  { to: '/account', label: 'Me', icon: 'user' },
]

export default function NavBar() {
  const { due } = useStore()
  return (
    <nav className="navbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
          <span className="tab-icon">
            <Icon name={t.icon} size={22} />
            {t.badge && due.count > 0 && (
              <span className="tab-badge" aria-label={`${due.count} follow-ups due`}>
                {due.count > 9 ? '9+' : due.count}
              </span>
            )}
          </span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
