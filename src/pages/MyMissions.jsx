import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateUtils';
import { MissionStatusBadge, UrgencyBadge } from '../components/shared/StatusBadge';

export default function MyMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/missions').then(res => {
      setMissions(res.data.filter(m => m.status !== 'בוטל'));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">המשימות שלי</h1>
        <p className="text-slate-500 text-sm">שלום, {user?.full_name}</p>
      </div>
      {missions.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">אין משימות מתוכננות</div>
      ) : (
        <div className="space-y-3">
          {missions.map(m => (
            <div key={m.id} className="card p-4 hover:bg-blue-50/40 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{m.title}</h3>
                  {m.location && <p className="text-sm text-slate-500 mt-0.5">{m.location}</p>}
                </div>
                <div className="flex gap-2">
                  <MissionStatusBadge status={m.status} />
                  <UrgencyBadge urgency={m.urgency} />
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-400">
                {formatDateTime(m.start_time)} — {formatDateTime(m.end_time)}
              </div>
              {m.notes && <p className="mt-2 text-sm text-slate-500">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
