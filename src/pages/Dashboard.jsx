import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateUtils';
import { MissionStatusBadge, UrgencyBadge } from '../components/shared/StatusBadge';

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#6b7280', '#ef4444'];

function StatCard({ label, value, sub, icon, color = 'blue' }) {
  const configs = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: 'text-slate-400' },
  };
  const c = configs[color];
  return (
    <div className={`stat-card border ${c.border} ${c.bg}`}>
      <div className={`text-3xl font-black ${c.text} mb-1`}>{value}</div>
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [soldiers, setSoldiers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/soldiers'),
      axios.get('/api/missions'),
      axios.get('/api/equipment/gaps'),
    ]).then(([s, m, g]) => {
      setSoldiers(s.data);
      setMissions(m.data);
      setGaps(g.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statusCounts = soldiers.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const activeMissions = missions.filter(m => m.status === 'פעיל');
  const plannedMissions = missions.filter(m => m.status === 'מתוכנן');
  const urgentMissions = missions.filter(m => m.urgency === 'חירום' && m.status !== 'בוטל' && m.status !== 'הסתיים');

  const typeMap = missions.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
  const barData = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

  const upcomingMissions = missions
    .filter(m => m.status === 'מתוכנן')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-slate-900">שלום, {user?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-400 text-sm mt-0.5">תמונת מצב אופרטיבית</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label='סה"כ לוחמים' value={soldiers.length} color="blue" />
        <StatCard label="זמינים" value={statusCounts['זמין'] || 0} color="green" />
        <StatCard label="משימות פעילות" value={activeMissions.length} sub={`${plannedMissions.length} מתוכננות`} color="amber" />
        <StatCard label="פערים לוגיסטיים" value={gaps.length} color={gaps.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Alerts */}
      {urgentMissions.length > 0 && (
        <div className="rounded-2xl p-4 bg-red-50 border border-red-200"
          style={{ boxShadow: '0 2px 8px rgba(220,38,38,0.1)' }}>
          <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {urgentMissions.length} משימות חירום פעילות
          </div>
          <div className="space-y-1">
            {urgentMissions.map(m => (
              <div key={m.id} className="text-sm text-red-600 font-medium">{m.title}</div>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200"
          style={{ boxShadow: '0 2px 8px rgba(245,158,11,0.1)' }}>
          <div className="flex items-center gap-2 text-amber-700 font-bold mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            פערים לוגיסטיים ({gaps.length} פריטים)
          </div>
          <div className="flex flex-wrap gap-2">
            {gaps.slice(0, 4).map(g => (
              <span key={g.id} className="badge-red">{g.name}: חסרים {g.gap}</span>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">סטטוס כוח אדם</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">משימות לפי סוג</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming missions */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-800 mb-4">משימות קרובות</h3>
        {upcomingMissions.length === 0 ? (
          <p className="text-slate-400 text-sm">אין משימות מתוכננות</p>
        ) : (
          <div className="space-y-2">
            {upcomingMissions.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors border border-slate-100">
                <div className="flex items-center gap-3">
                  <UrgencyBadge urgency={m.urgency} />
                  <span className="font-semibold text-slate-800 text-sm">{m.title}</span>
                  {m.location && <span className="text-slate-400 text-xs">{m.location}</span>}
                </div>
                <div className="text-slate-400 text-xs flex-shrink-0">{formatDateTime(m.start_time)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
