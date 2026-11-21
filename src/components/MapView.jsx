import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, useMapEvents } from 'react-leaflet'
import { useStore } from '../lib/store.jsx'
import { STATUSES, STATUS_BY_KEY } from '../lib/constants.js'
import { DEFAULT_CENTER, ARCGIS_KEY } from '../config.js'
import { searchAddress, reverseGeocode, distanceM } from '../lib/geo.js'
import { houseNumber } from '../lib/format.js'
import { isDue, isOverdue } from '../lib/dates.js'
import { Icon } from './Icon.jsx'
import DoorSheet from './DoorSheet.jsx'
import NewDoorSheet from './NewDoorSheet.jsx'
import PeekCard from './PeekCard.jsx'

// Remember where the map was when switching tabs
let savedView = null
let lastFix = null

// Address lookups from press-and-hold, remembered so the same roof isn't looked up twice
const peekCache = new Map()
const LABEL_ZOOM = 18
const TIP_KEY = 'villa-doors-peek-tip-seen'

const BASEMAP_KEY = 'villa-doors-basemap'
function readBasemap() {
  try {
    return localStorage.getItem(BASEMAP_KEY) === 'satellite' ? 'satellite' : 'map'
  } catch {
    return 'map'
  }
}

const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
]

function rangeStart(key) {
  const now = new Date()
  if (key === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (key === '7d') return now.getTime() - 7 * 864e5
  if (key === '30d') return now.getTime() - 30 * 864e5
  return 0
}

export default function MapView() {
  const { doors, profiles, userId, nameOf, knockedToday, dailyGoal, queue, due, syncNow } = useStore()
  const [params, setParams] = useSearchParams()
  const [map, setMap] = useState(null)
  const [me, setMe] = useState(lastFix)
  const [gpsError, setGpsError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState(null)
  const [hidden, setHidden] = useState(() => new Set())
  const [range, setRange] = useState('all')
  const [who, setWho] = useState('all')
  const [revisitsOnly, setRevisitsOnly] = useState(params.get('revisits') === '1')
  const [showFilters, setShowFilters] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [basemap, setBasemap] = useState(readBasemap)
  const [esriFailed, setEsriFailed] = useState(!ARCGIS_KEY)
  const esriErrors = useRef(0)
  const [view, setView] = useState(() => ({ zoom: savedView?.zoom || 0, bounds: null }))
  const [peek, setPeek] = useState(null)
  const peekSeq = useRef(0)
  const peekOpenedAt = useRef(0)
  const lastPress = useRef(0)
  const [showTip, setShowTip] = useState(() => {
    try {
      return !localStorage.getItem(TIP_KEY)
    } catch {
      return false
    }
  })
  const centeredOnce = useRef(!!savedView)
  const meRef = useRef(me)
  meRef.current = me

  // Remember when each new finger/mouse press starts (see onTap above)
  useEffect(() => {
    if (!map) return
    const el = map.getContainer()
    const onDown = () => {
      lastPress.current = Date.now()
    }
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('touchstart', onDown, true)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('touchstart', onDown, true)
    }
  }, [map])

  // Test hook (development only; stripped from the live app)
  useEffect(() => {
    if (import.meta.env.DEV && map) window.__map = map
  }, [map])

  // Opened from the Leads tab with ?revisits=1
  useEffect(() => {
    if (params.get('revisits') === '1') {
      setRevisitsOnly(true)
      params.delete('revisits')
      setParams(params, { replace: true })
    }
  }, [params])

  // GPS
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('This phone/browser does not support GPS.')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }
        lastFix = fix
        setMe(fix)
        setGpsError('')
      },
      (e) => {
        setGpsError(
          e.code === 1
            ? 'Location is blocked. Turn on location for this site in your phone settings.'
            : 'Waiting for GPS…',
        )
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Center on the user the first time we get a fix
  useEffect(() => {
    if (map && me && !centeredOnce.current) {
      centeredOnce.current = true
      map.setView([me.lat, me.lng], 18)
    }
  }, [map, me])

  const since = rangeStart(range)
  const people = useMemo(() => Object.values(profiles), [profiles])
  const whoOf = (d) => d.updated_by || d.created_by

  const inScope = (d) =>
    (since === 0 || new Date(d.updated_at).getTime() >= since) && (who === 'all' || whoOf(d) === who)

  const visible = useMemo(
    () =>
      doors.filter((d) => {
        if (revisitsOnly) return d.status === 'come_back' && inScope(d)
        return !hidden.has(d.status) && inScope(d)
      }),
    [doors, hidden, since, who, revisitsOnly],
  )
  const counts = useMemo(() => {
    const c = {}
    for (const d of doors) if (inScope(d)) c[d.status] = (c[d.status] || 0) + 1
    return c
  }, [doors, since, who])

  const selected = doors.find((d) => d.id === selectedId)
  const filtersOn = hidden.size > 0 || range !== 'all' || who !== 'all' || revisitsOnly

  function dismissTip() {
    setShowTip(false)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  function nearestDoor(lat, lng, maxM) {
    let best = null
    for (const d of doors) {
      const m = distanceM([lat, lng], [d.lat, d.lng])
      if (m <= maxM && (!best || m < best.m)) best = { door: d, m }
    }
    return best
  }

  // Press and hold on the map: show the address of that spot
  async function startPeek(latlng) {
    if (placing || newPin || selectedId) return
    dismissTip()
    setResults(null)
    const { lat, lng } = latlng
    const near = nearestDoor(lat, lng, 15)
    const id = ++peekSeq.current
    peekOpenedAt.current = Date.now()
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    const cached = peekCache.get(key)
    if (cached) {
      setPeek({ lat, lng, near, status: 'done', result: cached, chosen: pickBest(cached) })
      return
    }
    setPeek({ lat, lng, near, status: 'loading', result: null, chosen: null })
    const r = await reverseGeocode(lat, lng)
    peekCache.set(key, r)
    if (peekSeq.current !== id) return
    setPeek((p) => (p ? { ...p, status: 'done', result: r, chosen: pickBest(r) } : p))
  }

  function logFromPeek() {
    if (!peek) return
    const { lat, lng, result, chosen } = peek
    setPeek(null)
    setNewPin({
      lat,
      lng,
      prefill: chosen
        ? { address: chosen.address, hasNumber: chosen.hasNumber, options: result?.options || [] }
        : null,
    })
  }

  function toggleBasemap() {
    const next = basemap === 'map' ? 'satellite' : 'map'
    setBasemap(next)
    try {
      localStorage.setItem(BASEMAP_KEY, next)
    } catch {
      /* ignore */
    }
  }

  function onEsriTileError() {
    esriErrors.current += 1
    if (esriErrors.current >= 4) setEsriFailed(true)
  }

  function locate() {
    if (me && map) map.flyTo([me.lat, me.lng], Math.max(map.getZoom(), 18), { duration: 0.6 })
  }

  function startPlacing() {
    setSelectedId(null)
    setResults(null)
    setPlacing(true)
    const fix = meRef.current
    if (fix && map) map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 19))
  }

  function dropPin() {
    const c = map.getCenter()
    setPlacing(false)
    setNewPin({ lat: c.lat, lng: c.lng })
  }

  async function runSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    const c = map ? map.getCenter() : null
    setResults('loading')
    const r = await searchAddress(query.trim(), c ? [c.lat, c.lng] : null)
    setResults(r)
  }

  function toggleStatus(key) {
    setHidden((h) => {
      const n = new Set(h)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  function clearFilters() {
    setHidden(new Set())
    setRange('all')
    setWho('all')
    setRevisitsOnly(false)
  }

  const goalPct = Math.min(100, Math.round((knockedToday / Math.max(1, dailyGoal)) * 100))

  return (
    <div className="map-page">
      <MapContainer
        ref={setMap}
        center={savedView?.center || (me ? [me.lat, me.lng] : DEFAULT_CENTER)}
        zoom={savedView?.zoom || (me ? 18 : 14)}
        maxZoom={20}
        zoomControl={false}
        tapHold
        className="map"
      >
        {basemap === 'map' && (
          <TileLayer
            key="osm"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={20}
          />
        )}
        {basemap === 'satellite' && !esriFailed && (
          <>
            <TileLayer
              key="esri-imagery"
              attribution="Esri, Maxar, Earthstar Geographics"
              url={`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`}
              maxNativeZoom={19}
              maxZoom={20}
              eventHandlers={{ tileerror: onEsriTileError }}
            />
            <TileLayer
              key="esri-labels"
              attribution="TomTom, Garmin, &copy; OSM"
              url={`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`}
              tileSize={512}
              zoomOffset={-1}
              maxNativeZoom={20}
              maxZoom={20}
            />
          </>
        )}
        {basemap === 'satellite' && esriFailed && (
          <TileLayer
            key="usgs"
            attribution="USGS The National Map: Orthoimagery"
            url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={20}
          />
        )}
        <ViewSaver
          onView={setView}
          onHold={startPeek}
          onTap={() => {
            // Lifting the finger after a long-press can register as a tap. Only close
            // the card for a new press that started after the card opened.
            if (peek && lastPress.current > peekOpenedAt.current) setPeek(null)
          }}
        />
        {visible.map((d) => {
          const isSel = d.id === selectedId
          const dueNow = d.status === 'come_back' && isDue(d.follow_up_at)
          const num =
            view.zoom >= LABEL_ZOOM && (!view.bounds || view.bounds.contains([d.lat, d.lng]))
              ? houseNumber(d.address)
              : null
          return (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lng]}
              radius={isSel ? 13 : 10}
              pathOptions={{
                color: dueNow ? (isOverdue(d.follow_up_at) ? '#dc2626' : '#f59e0b') : '#fff',
                weight: isSel ? 4 : dueNow ? 3.5 : 2.5,
                dashArray: d._pending ? '3 3' : null,
                fillColor: STATUS_BY_KEY[d.status]?.color || '#666',
                fillOpacity: d._pending ? 0.7 : 1,
              }}
              eventHandlers={{
                click: () => {
                  if (placing) return
                  setPeek(null)
                  setSelectedId(d.id)
                },
              }}
            >
              {num && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -9]}
                  className={'pin-label' + (isSel ? ' sel' : '')}
                  interactive={false}
                >
                  {num}
                </Tooltip>
              )}
            </CircleMarker>
          )
        })}
        {peek && (
          <>
            <CircleMarker
              center={[peek.lat, peek.lng]}
              radius={16}
              pathOptions={{ color: '#fff', weight: 3, dashArray: '4 4', fill: false, className: 'peek-ring' }}
              interactive={false}
            />
            <CircleMarker
              center={[peek.lat, peek.lng]}
              radius={5}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#1f4d2e', fillOpacity: 1 }}
              interactive={false}
            />
          </>
        )}
        {me && (
          <>
            {me.acc < 200 && (
              <Circle
                center={[me.lat, me.lng]}
                radius={me.acc}
                pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }}
                interactive={false}
              />
            )}
            <CircleMarker
              center={[me.lat, me.lng]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
              interactive={false}
            />
          </>
        )}
      </MapContainer>

      {/* Top bar: search + filters */}
      {!placing && (
        <div className="map-top">
          <form className="search-bar" onSubmit={runSearch}>
            <Icon name="search" size={18} />
            <input
              placeholder="Search an address"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value) setResults(null)
              }}
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => {
                  setQuery('')
                  setResults(null)
                }}
                aria-label="Clear"
              >
                <Icon name="close" size={16} />
              </button>
            )}
            <button
              type="button"
              className={'icon-btn sm' + (showFilters || filtersOn ? ' on' : '')}
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filters"
            >
              <Icon name="filter" size={18} />
            </button>
          </form>

          {results && (
            <div className="search-results card">
              {results === 'loading' && <div className="muted pad">Searching…</div>}
              {Array.isArray(results) && results.length === 0 && <div className="muted pad">No matches.</div>}
              {Array.isArray(results) &&
                results.map((r, i) => (
                  <button
                    key={i}
                    className="result-row"
                    onClick={() => {
                      map.flyTo([r.lat, r.lng], 19, { duration: 0.6 })
                      setResults(null)
                    }}
                  >
                    {r.label}
                  </button>
                ))}
            </div>
          )}

          {showFilters && (
            <div className="filter-panel card">
              <div className="filter-label">Show</div>
              <div className="seg">
                <button className={'seg-btn' + (!revisitsOnly ? ' on' : '')} onClick={() => setRevisitsOnly(false)}>
                  All pins
                </button>
                <button className={'seg-btn' + (revisitsOnly ? ' on' : '')} onClick={() => setRevisitsOnly(true)}>
                  Come back ({doors.filter((d) => d.status === 'come_back').length})
                </button>
              </div>
              {!revisitsOnly && (
                <div className="chip-row">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      className={'chip' + (hidden.has(s.key) ? ' off' : '')}
                      style={{ '--c': s.color }}
                      onClick={() => toggleStatus(s.key)}
                    >
                      <span className="dot" />
                      {s.label} <b>{counts[s.key] || 0}</b>
                    </button>
                  ))}
                </div>
              )}
              <div className="filter-label">Who</div>
              <div className="chip-row">
                <button className={'chip toggle' + (who === 'all' ? ' on' : '')} onClick={() => setWho('all')}>
                  Everyone
                </button>
                {people.map((p) => (
                  <button
                    key={p.id}
                    className={'chip toggle' + (who === p.id ? ' on' : '')}
                    onClick={() => setWho(p.id)}
                  >
                    {p.id === userId ? 'Me' : p.full_name || nameOf(p.id)}
                  </button>
                ))}
              </div>
              <div className="filter-label">When</div>
              <select value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              {filtersOn && (
                <button className="btn link" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!showFilters && !results && (
            <div className="map-chips">
              <div className="goal-pill" title="Doors you've knocked today vs. the daily goal">
                <span className="goal-text">
                  <b>{knockedToday}</b>/{dailyGoal} today
                </span>
                <span className="goal-track">
                  <span className="goal-fill" style={{ width: goalPct + '%' }} />
                </span>
              </div>
              {revisitsOnly ? (
                <button className="legend on" onClick={() => setRevisitsOnly(false)}>
                  Come-back pins only ✕
                </button>
              ) : (
                <div className="legend">
                  {STATUSES.map((s) => (
                    <span key={s.key} className={hidden.has(s.key) ? 'off' : ''}>
                      <i style={{ background: s.color }} />
                      {counts[s.key] || 0}
                    </span>
                  ))}
                </div>
              )}
              {due.revisits.length > 0 && !revisitsOnly && (
                <button className="legend warn" onClick={() => setRevisitsOnly(true)}>
                  {due.revisits.length} to revisit
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {queue.length > 0 && !placing && (
        <button className="pending-bar" onClick={syncNow}>
          {queue.length} {queue.length === 1 ? 'knock' : 'knocks'} saved on this phone, waiting for signal. Tap to retry.
        </button>
      )}

      {gpsError && !placing && <div className="gps-note">{gpsError}</div>}

      {/* Placement mode */}
      {placing && (
        <>
          <div className="crosshair">
            <Icon name="pin" size={44} stroke={2.2} />
          </div>
          <div className="place-bar card">
            <div className="small">Move the map so the pin sits on the house.</div>
            <div className="row gap">
              <button className="btn" onClick={() => setPlacing(false)}>
                Cancel
              </button>
              <button className="btn primary grow" onClick={dropPin}>
                Drop pin here
              </button>
            </div>
          </div>
        </>
      )}

      {peek && !placing && !selected && !newPin && (
        <PeekCard
          peek={peek}
          onClose={() => setPeek(null)}
          onLog={logFromPeek}
          onOpenDoor={(id) => {
            setPeek(null)
            setSelectedId(id)
          }}
          onPickOption={(o) => setPeek((p) => ({ ...p, chosen: o }))}
        />
      )}

      {showTip && !peek && !placing && !selected && !newPin && !queue.length && view.zoom >= 16 && (
        <div className="hold-tip" role="note">
          <span>
            <b>Tip:</b> press and hold on any house to see its address.
          </span>
          <button className="icon-btn sm" onClick={dismissTip} aria-label="Got it">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Floating buttons */}
      {!placing && !selected && !newPin && !peek && (
        <>
          <button className="fab locate" onClick={locate} disabled={!me} aria-label="Center on me">
            <Icon name="locate" size={22} />
          </button>
          <button
            className={'fab basemap-toggle' + (basemap === 'satellite' ? ' on' : '')}
            onClick={toggleBasemap}
            aria-label={basemap === 'map' ? 'Show satellite view' : 'Show street map'}
          >
            <Icon name={basemap === 'map' ? 'satellite' : 'map'} size={20} />
            <span>{basemap === 'map' ? 'Satellite' : 'Map'}</span>
          </button>
          <button className="fab main" onClick={startPlacing}>
            <Icon name="plus" size={22} stroke={2.6} />
            Log a door
          </button>
        </>
      )}

      {selected && <DoorSheet door={selected} onClose={() => setSelectedId(null)} />}
      {newPin && (
        <NewDoorSheet
          pin={newPin}
          onClose={() => setNewPin(null)}
          onOpenExisting={(id) => {
            setNewPin(null)
            setSelectedId(id)
          }}
          onSavedNext={() => setTimeout(startPlacing, 50)}
        />
      )}
    </div>
  )
}

function ViewSaver({ onView, onHold, onTap }) {
  const map = useMapEvents({
    moveend(e) {
      const m = e.target
      savedView = { center: m.getCenter(), zoom: m.getZoom() }
      onView({ zoom: m.getZoom(), bounds: m.getBounds().pad(0.2) })
    },
    // Long-press on phones (and right-click on a computer)
    contextmenu(e) {
      e.originalEvent?.preventDefault?.()
      onHold(e.latlng)
    },
    click() {
      onTap()
    },
  })
  useEffect(() => {
    onView({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) })
  }, [map])
  return null
}

function pickBest(r) {
  if (!r) return null
  const withNum = (r.options || []).find((o) => o.hasNumber)
  if (withNum) return withNum
  if (r.options?.[0]) return r.options[0]
  return r.address ? { address: r.address, hasNumber: r.hasNumber } : null
}
