export const STATUSES = [
  { key: 'lead', label: 'Lead', color: '#16a34a' },
  { key: 'maybe', label: 'Maybe', color: '#f59e0b' },
  { key: 'come_back', label: 'Come Back Later', color: '#2563eb' },
  { key: 'not_home', label: 'Not Home', color: '#8b95a5' },
  { key: 'not_interested', label: 'Not Interested', color: '#dc2626' },
  { key: 'no_soliciting', label: 'No Soliciting', color: '#1f2937' },
]

export const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s]))

export const SERVICES = [
  'Paver patio',
  'Retaining wall',
  'Concrete',
  'Artificial turf',
  'Landscape lighting',
  'Drainage',
  'Plants / beds',
  'Other',
]

// Where a lead came from
export const SOURCES = ['Door knock', 'Referral', 'Yard sign', 'Facebook / Ads', 'Website', 'Repeat customer', 'Other']

export const STAGES = [
  { key: 'lead', label: 'Lead', color: '#16a34a' },
  { key: 'client', label: 'Client', color: '#1f4d2e' },
  { key: 'lost', label: 'Lost', color: '#8b95a5' },
]
export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]))

export const ESTIMATE_STATUSES = [
  { key: 'draft', label: 'Draft', color: '#8b95a5' },
  { key: 'sent', label: 'Sent', color: '#2563eb' },
  { key: 'accepted', label: 'Accepted', color: '#16a34a' },
  { key: 'declined', label: 'Declined', color: '#dc2626' },
]
export const EST_STATUS_BY_KEY = Object.fromEntries(ESTIMATE_STATUSES.map((s) => [s.key, s]))

export const UNITS = ['', 'sq ft', 'ln ft', 'ea', 'hr', 'ton', 'yd³', 'lump sum']

export const DEFAULT_DAILY_GOAL = 50
