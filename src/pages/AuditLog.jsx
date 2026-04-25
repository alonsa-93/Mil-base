import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDateTime } from '../utils/dateUtils';

const ACTION_COLORS = {
  LOGIN: 'badge-blue', LOGIN_2FA: 'badge-blue',
  CREATE_SOLDIER: 'badge-green', CREATE_MISSION: 'badge-green', CREATE_USER: 'badge-green',
  UPDATE_SOLDIER: 'badge-yellow', UPDATE_MISSION: 'badge-yellow',
  DELETE_SOLDIER: 'badge-red', DELETE_MISSION: 'badge-red',
  ASSIGN_SOLDIER: 'badge-blue', UNASSIGN_SOLDIER: 'badge-yellow',
  ISSUE_EQUIPMENT: 'badge-yellow', RETURN_EQUIPMENT: 'badge-green',
  BULK_STATUS_UPDATE: 'badge-orange', BULK_DELETE_SOLDIERS: 'badge-red',
  UPDATE_SOLDIER_EQUIPMENT: 'badge-blue',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get('/api/audit', { params: { entity_type: filterType || undefined, limit: 200 } })
      .then(r => setLogs(r.data))
      .finally(() => setLoading(false));
  }, [filterType]);

  const entityTypes = ['auth', 'soldiers', 'missions', 'assignments', 'equipment', 'users'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">לוג פעולות</h1>
        <p className="text-slate-500 text-sm">רישום בלתי מחיק של כל פעולה במערכת</p>
      </div>

      <div className="flex gap-3">
        <select className="select text-sm w-auto" value={filterType} onChange={e => { setFilterType(e.target.value); setLoading(true); }}>
          <option value="">כל הסוגים</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                <th className="text-right px-4 py-3">זמן</th>
                <th className="text-right px-4 py-3">משתמש</th>
                <th className="text-right px-4 py-3">פעולה</th>
                <th className="text-right px-4 py-3">ישות</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="text-center py-8 text-slate-400">טוען...</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">אין נתונים להצגה</td></tr>}
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap font-mono">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{log.username || '—'}</td>
                  <td className="px-4 py-3"><span className={ACTION_COLORS[log.action] || 'badge-gray'}>{log.action}</span></td>
                  <td className="px-4 py-3 text-slate-500">{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                  <td className="px-4 py-3">
                    {(log.old_value || log.new_value) && (
                      <button onClick={() => setSelected(selected?.id === log.id ? null : log)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        {selected?.id === log.id ? 'סגור' : 'פרטים'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card p-4 animate-slide-up bg-slate-50">
          <h4 className="text-sm font-bold text-slate-700 mb-3">פרטי פעולה #{selected.id}</h4>
          <div className="grid md:grid-cols-2 gap-3">
            {selected.old_value && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">לפני</div>
                <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 overflow-auto max-h-40">{JSON.stringify(JSON.parse(selected.old_value), null, 2)}</pre>
              </div>
            )}
            {selected.new_value && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">אחרי</div>
                <pre className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 overflow-auto max-h-40">{JSON.stringify(JSON.parse(selected.new_value), null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
