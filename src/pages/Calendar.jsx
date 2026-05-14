import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../utils/rbac';
import { formatTime, formatDate, getWeekDays, getMonthDays, isSameDay, missionOverlapsDay, DAY_NAMES, MONTH_NAMES } from '../utils/dateUtils';
import { MissionStatusBadge, UrgencyBadge } from '../components/shared/StatusBadge';
import Modal from '../components/shared/Modal';

const URGENCIES = ['רגיל','דחוק','חירום'];
const TYPES = ['כללי','שמירה','סיור','אבטחה','לוגיסטיקה','אימון','אחר'];
const STATUSES = ['מתוכנן','פעיל','הסתיים','בוטל'];

const defaultMission = {
  title:'', description:'', location:'', start_time:'', end_time:'',
  urgency:'רגיל', type:'כללי', required_count:1, vehicle:'', notes:'',
};

export default function Calendar() {
  const { user } = useAuth();
  // Default to month view so the user sees the full current month at once.
  const [view, setView] = useState('month'); // week | month
  const [baseDate, setBaseDate] = useState(new Date());
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missionModal, setMissionModal] = useState(null); // null | 'add' | 'detail'
  const [selectedMission, setSelectedMission] = useState(null);
  const [form, setForm] = useState(defaultMission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assignModal, setAssignModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const canWrite = canEdit(user?.role);

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/missions');
      setMissions(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // Week navigation
  const weekDays = getWeekDays(baseDate);
  const weekLabel = `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`;

  // Month navigation
  const monthDays = getMonthDays(baseDate.getFullYear(), baseDate.getMonth());
  const monthLabel = `${MONTH_NAMES[baseDate.getMonth()]} ${baseDate.getFullYear()}`;

  function navigate(dir) {
    setBaseDate(d => {
      const nd = new Date(d);
      if (view === 'week') nd.setDate(nd.getDate() + dir * 7);
      else nd.setMonth(nd.getMonth() + dir);
      return nd;
    });
  }

  function getMissionsForDay(day) {
    return missions.filter(m => missionOverlapsDay(m, day));
  }

  function openAdd(day) {
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth()+1)}-${pad(day.getDate())}`;
    setForm({ ...defaultMission, start_time: `${dateStr}T08:00`, end_time: `${dateStr}T16:00` });
    setError('');
    setMissionModal('add');
  }

  function openDetail(m) {
    setSelectedMission(m);
    setMissionModal('detail');
  }

  async function openDetail2(m) {
    try {
      const res = await axios.get(`/api/missions/${m.id}`);
      setSelectedMission(res.data);
      setMissionModal('detail');
    } catch { setSelectedMission(m); setMissionModal('detail'); }
  }

  async function handleSaveMission() {
    setSaving(true); setError('');
    try {
      await axios.post('/api/missions', form);
      await fetchMissions();
      setMissionModal(null);
    } catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
    finally { setSaving(false); }
  }

  async function handleUpdateStatus(status) {
    await axios.put(`/api/missions/${selectedMission.id}`, { status });
    await fetchMissions();
    setMissionModal(null);
  }

  async function handleDeleteMission() {
    if (!confirm('למחוק משימה זו?')) return;
    await axios.delete(`/api/missions/${selectedMission.id}`);
    await fetchMissions();
    setMissionModal(null);
  }

  async function openAssign() {
    setAssignModal(true);
    const res = await axios.post(`/api/missions/${selectedMission.id}/suggest`);
    setSuggestions(res.data.suggestions);
  }

  async function assignSoldier(soldier, force = false) {
    setAssigning(true);
    try {
      await axios.post('/api/assignments', {
        mission_id: selectedMission.id,
        soldier_id: soldier.id,
        force,
      });
      const res = await axios.get(`/api/missions/${selectedMission.id}`);
      setSelectedMission(res.data);
      const res2 = await axios.post(`/api/missions/${selectedMission.id}/suggest`);
      setSuggestions(res2.data.suggestions);
    } catch (e) {
      alert(e.response?.data?.error || 'שגיאה');
    } finally { setAssigning(false); }
  }

  async function removeAssignment(assignId) {
    await axios.delete(`/api/assignments/${assignId}`);
    const res = await axios.get(`/api/missions/${selectedMission.id}`);
    setSelectedMission(res.data);
  }

  const urgencyColor = { 'רגיל':'border-r-blue-500', 'דחוק':'border-r-amber-500', 'חירום':'border-r-red-500' };
  const statusBg = { 'מתוכנן':'bg-blue-100/80', 'פעיל':'bg-emerald-100/80', 'הסתיים':'bg-slate-100/80', 'בוטל':'bg-red-100/80' };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">לוח משימות</h1>
          <p className="text-slate-500 text-sm">{missions.length} משימות</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800'}`}>שבועי</button>
            <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800'}`}>חודשי</button>
          </div>
          <button onClick={() => navigate(-1)} className="btn-secondary px-3 py-1.5 text-sm">‹</button>
          <button onClick={() => setBaseDate(new Date())} className="btn-ghost px-3 py-1.5 text-sm">היום</button>
          <button onClick={() => navigate(1)} className="btn-secondary px-3 py-1.5 text-sm">›</button>
        </div>
      </div>

      {/* Week View */}
      {view === 'week' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-600">{weekLabel}</div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const dayMissions = getMissionsForDay(day);
                return (
                  <div key={i} className={`border-r border-slate-100 last:border-r-0 min-h-[180px] ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className={`px-2 py-2 text-center border-b border-slate-100 ${isToday ? 'bg-blue-100' : ''}`}>
                      <div className="text-xs text-slate-400">{DAY_NAMES[day.getDay()]}</div>
                      <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{day.getDate()}</div>
                    </div>
                    <div className="p-1 space-y-1">
                      {dayMissions.map(m => (
                        <button key={m.id} onClick={() => openDetail2(m)}
                          className={`w-full text-right px-2 py-1.5 rounded-lg text-xs border-r-2 ${urgencyColor[m.urgency]} ${statusBg[m.status]} hover:opacity-80 transition-opacity`}>
                          <div className="font-semibold text-slate-800 truncate">{m.title}</div>
                          <div className="text-slate-500">{formatTime(m.start_time)}</div>
                        </button>
                      ))}
                      {canWrite && (
                        <button onClick={() => openAdd(day)} className="w-full text-center py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs transition-colors">+</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Month View — full current month, large cells, scrollable per-day */}
      {view === 'month' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">{monthLabel}</div>
            <div className="text-xs text-slate-400">{monthDays.filter(Boolean).reduce((a, d) => a + getMissionsForDay(d).length, 0)} משימות החודש</div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {DAY_NAMES.map(d => <div key={d} className="text-center py-2 text-xs font-semibold text-slate-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[120px] sm:min-h-[140px] border-b border-r border-slate-100 bg-slate-50/50" />;
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 6; // Saturday
              const dayMissions = getMissionsForDay(day);
              return (
                <div
                  key={i}
                  className={`min-h-[120px] sm:min-h-[140px] border-b border-r border-slate-100 p-1.5 flex flex-col ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-slate-50/40 hover:bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-600'}`} dir="ltr">{day.getDate()}</div>
                    {canWrite && (
                      <button
                        onClick={() => openAdd(day)}
                        aria-label="הוסף משימה"
                        className="w-5 h-5 rounded-md text-slate-300 hover:text-blue-600 hover:bg-blue-50 text-sm leading-none transition-colors"
                      >+</button>
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-y-auto max-h-[110px]">
                    {dayMissions.slice(0, 4).map(m => (
                      <button key={m.id} onClick={() => openDetail2(m)}
                        title={`${m.title} (${formatTime(m.start_time)})`}
                        className={`w-full text-right px-1.5 py-1 rounded-md text-[11px] leading-tight border-r-2 ${urgencyColor[m.urgency]} ${statusBg[m.status]} hover:opacity-80 truncate font-medium text-slate-800 transition-opacity`}>
                        <span className="font-mono text-[10px] text-slate-500 ml-1" dir="ltr">{formatTime(m.start_time)}</span>
                        {m.title}
                      </button>
                    ))}
                    {dayMissions.length > 4 && (
                      <button
                        onClick={() => { setBaseDate(day); setView('week'); }}
                        className="w-full text-right text-[10px] text-blue-600 hover:text-blue-800 pr-1.5 font-semibold transition-colors"
                      >+{dayMissions.length - 4} נוספות</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Mission Modal */}
      <Modal open={missionModal === 'add'} onClose={() => setMissionModal(null)} title="יצירת משימה" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">שם משימה *</label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="שמירת בסיס..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">התחלה *</label>
              <input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">סיום *</label>
              <input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">דחיפות</label>
              <select className="select" value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}>
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">סוג</label>
              <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">מיקום</label>
              <input className="input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label className="label">כמות נדרשת</label>
              <input type="number" min={1} className="input" value={form.required_count} onChange={e => setForm(p => ({ ...p, required_count: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea className="input h-20 resize-none" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleSaveMission} disabled={saving} className="btn-primary flex-1">{saving ? 'שומר...' : 'יצירה'}</button>
            <button onClick={() => setMissionModal(null)} className="btn-secondary">ביטול</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={missionModal === 'detail'} onClose={() => { setMissionModal(null); setAssignModal(false); }} title={selectedMission?.title} size="lg">
        {selectedMission && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <MissionStatusBadge status={selectedMission.status} />
              <UrgencyBadge urgency={selectedMission.urgency} />
              <span className="badge-gray">{selectedMission.type}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-400 text-xs">התחלה</div><div className="text-slate-800 font-medium">{formatTime(selectedMission.start_time)} {formatDate(selectedMission.start_time)}</div></div>
              <div><div className="text-slate-400 text-xs">סיום</div><div className="text-slate-800 font-medium">{formatTime(selectedMission.end_time)} {formatDate(selectedMission.end_time)}</div></div>
              {selectedMission.location && <div><div className="text-slate-400 text-xs">מיקום</div><div className="text-slate-800 font-medium">{selectedMission.location}</div></div>}
              <div><div className="text-slate-400 text-xs">נדרש</div><div className="text-slate-800 font-medium">{selectedMission.assignments?.length || 0} / {selectedMission.required_count}</div></div>
            </div>
            {selectedMission.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{selectedMission.notes}</p>}

            {/* Assignments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700">שיבוץ לוחמים ({selectedMission.assignments?.length || 0}/{selectedMission.required_count})</span>
                {canWrite && selectedMission.status !== 'בוטל' && selectedMission.status !== 'הסתיים' && (
                  <button onClick={openAssign} className="text-xs btn-secondary py-1 px-2">+ שיבוץ</button>
                )}
              </div>
              {selectedMission.assignments?.length === 0 && <p className="text-slate-500 text-xs">אין לוחמים משובצים</p>}
              <div className="space-y-1">
                {selectedMission.assignments?.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{a.full_name}</span>
                    <div className="flex items-center gap-2">
                      {a.rest_warning ? <span className="badge-yellow text-xs">חריגת מנוחה</span> : null}
                      {canWrite && <button onClick={() => removeAssignment(a.id)} className="text-slate-500 hover:text-red-400 text-xs transition-colors">הסרה</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-assign panel */}
            {assignModal && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <h4 className="text-sm font-bold text-slate-700 mb-2">הצעות שיבוץ (לפי הוגנות)</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {suggestions.length === 0 && <p className="text-slate-400 text-xs">אין לוחמים זמינים</p>}
                  {suggestions.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs shadow-sm">
                      <div>
                        <span className="font-semibold text-slate-800">{s.full_name}</span>
                        <span className="text-slate-400 mr-2">{s.monthlyHours}h/30d</span>
                        {s.hasRestWarning && <span className="badge-yellow text-xs mr-1">⚠️ {s.hoursSinceRest}h מנוחה</span>}
                      </div>
                      <button onClick={() => assignSoldier(s)} disabled={assigning} className="btn-primary py-0.5 px-2 text-xs">שבץ</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canWrite && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {selectedMission.status === 'מתוכנן' && <button onClick={() => handleUpdateStatus('פעיל')} className="btn-primary text-sm">הפעל</button>}
                {selectedMission.status === 'פעיל' && <button onClick={() => handleUpdateStatus('הסתיים')} className="btn-secondary text-sm">סיים</button>}
                {selectedMission.status !== 'בוטל' && selectedMission.status !== 'הסתיים' && (
                  <button onClick={() => handleUpdateStatus('בוטל')} className="btn-secondary text-sm text-amber-400">בטל</button>
                )}
                <button onClick={handleDeleteMission} className="btn-danger text-sm mr-auto">מחיקה</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
