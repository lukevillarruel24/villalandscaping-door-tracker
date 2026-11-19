import { NavLink } from 'react-router-dom'
import { Icon } from './Icon.jsx'

const TABS = [
  { to: '/', label: 'Map', icon: 'map', end: true },
  { to: '/leads', label: 'Leads', icon: 'star' },
  { to: '/clients', label: 'Clients', icon: 'briefcase' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
  { to: '/account', label: 'Me', icon: 'user' },
]

export default function NavBar() {
  return (
    <nav className="navbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
