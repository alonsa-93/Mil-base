export function SoldierStatusBadge({ status }) {
  const map = {
    'זמין': 'badge-green',
    'במשימה': 'badge-yellow',
    'מנוחה': 'badge-blue',
    'חופשה': 'badge-gray',
    'אחר': 'badge-gray',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

export function MissionStatusBadge({ status }) {
  const map = {
    'מתוכנן': 'badge-blue',
    'פעיל': 'badge-green',
    'הסתיים': 'badge-gray',
    'בוטל': 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

export function UrgencyBadge({ urgency }) {
  const map = {
    'רגיל': 'badge-blue',
    'דחוק': 'badge-yellow',
    'חירום': 'badge-red',
  };
  return <span className={map[urgency] || 'badge-gray'}>{urgency}</span>;
}
