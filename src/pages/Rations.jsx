import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { canManageLogistics } from '../utils/rbac';
import Modal from '../components/shared/Modal';

const MEAL_TYPES = ['ארוחת בוקר', 'ארוחת צהריים', 'ארוחת ערב'];

function exportListToExcel(soldiers, title) {
  import('xlsx').then(XLSX => {
    const headers = ['שם מלא', 'טלפון', 'פלוגה', 'צוות'];
    const rows = soldiers.map(s => [s.full_name, s.phone || '', s.company ? `פלוגה ${s.company}` : '', s.team || '']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

async function exportListToPdf(soldiers, title) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('he-IL');
  doc.setFontSize(13);
  doc.text(`${title} — ${today}`, doc.internal.pageSize.width - 15, 15, { align: 'right' });
  autoTable(doc, {
    head: [['שם מלא', 'טלפון', 'פלוגה', 'צוות']],
    body: soldiers.map(s => [s.full_name, s.phone || '', s.company ? `פלוגה ${s.company}` : '', s.team || '']),
    styles: { halign: 'right', fontSize: 10, font: 'helvetica' },
    headStyles: { fillColor: [30, 64, 175], halign: 'right', textColor: 255 },
    margin: { top: 25, right: 15, left: 15 },
    startY: 25,
  });
  doc.save(`${title}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

const DEMAND_ITEMS = [
  { key: 'total', label: 'סה"כ', color: 'blue', filterKey: null },
  { key: 'standard', label: 'סטנדרטי', color: 'slate', filterKey: 'standard' },
  { key: 'vegan', label: 'טבעוני', color: 'emerald', filterKey: 'vegan' },
  { key: 'vegetarian', label: 'צמחוני', color: 'teal', filterKey: 'vegetarian' },
  { key: 'lactose_free', label: 'ללא לקטוז', color: 'amber', filterKey: 'lactose_free' },
  { key: 'gluten_free', label: 'ללא גלוטן', color: 'orange', filterKey: 'gluten_free' },
];

const COLOR_CLASSES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  slate: 'bg-slate-50 border-slate-200 text-slate-600',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
};

export default function Rations() {
  const { user } = useAuth();
  const [demand, setDemand] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null); // { title, soldiers }
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), meal_type: 'ארוחת צהריים', notes: '' });
  const [saving, setSaving] = useState(false);
  const canWrite = canManageLogistics(user?.role);

  useEffect(() => {
    Promise.all([axios.get('/api/rations/demand'), axios.get('/api/rations')]).then(([d, r]) => {
      setDemand(d.data); setRequests(r.data);
    }).finally(() => setLoading(false));
  }, []);

  function openDetail(item) {
    if (!demand?.soldiers) return;
    let soldiers = demand.soldiers;
    if (item.filterKey === 'vegan') soldiers = soldiers.filter(s => s.is_vegan);
    else if (item.filterKey === 'vegetarian') soldiers = soldiers.filter(s => s.is_vegetarian && !s.is_vegan);
    else if (item.filterKey === 'lactose_free') soldiers = soldiers.filter(s => s.lactose_intolerant);
    else if (item.filterKey === 'gluten_free') soldiers = soldiers.filter(s => s.gluten_free);
    else if (item.filterKey === 'standard') soldiers = soldiers.filter(s => !s.is_vegan && !s.is_vegetarian && !s.lactose_intolerant && !s.gluten_free);
    setDetailModal({ title: item.label, soldiers });
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_count: demand.total,
        vegan_count: demand.vegan,
        vegetarian_count: demand.vegetarian,
        lactose_free_count: demand.lactose_free,
        gluten_free_count: demand.gluten_free,
      };
      const res = await axios.post('/api/rations', payload);
      setRequests(prev => [res.data, ...prev]);
      setModal(false);
    } catch (e) { alert(e.response?.data?.error || 'שגיאה'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    await axios.delete(`/api/rations/${id}`);
    setRequests(prev => prev.filter(r => r.id !== id));
  }

  if (loading) return (
    <div className="flex justify-center h-32 items-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">הזנה ומים</h1>
          <p className="text-slate-500 text-sm">ניהול ארוחות ודרישות מזון</p>
        </div>
        {canWrite && (
          <button onClick={() => setModal(true)} className="btn-primary text-sm">יצירת דרישה</button>
        )}
      </div>

      {/* Demand cards */}
      {demand && (
        <div>
          <h3 className="font-bold text-slate-700 mb-3 text-sm">דרישת מזון נוכחית — לחץ על קטגוריה לפירוט</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {DEMAND_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => openDetail(item)}
                className={`stat-card text-center border cursor-pointer ${COLOR_CLASSES[item.color]}`}
              >
                <div className="text-3xl font-black">{demand[item.key] ?? 0}</div>
                <div className="text-xs font-semibold mt-1 opacity-80">{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Requests History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">היסטוריית דרישות</h3>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center text-slate-400">אין דרישות קודמות</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                <th className="text-right px-4 py-3">תאריך</th>
                <th className="text-right px-4 py-3">ארוחה</th>
                <th className="text-right px-4 py-3">סה"כ</th>
                <th className="text-right px-4 py-3">מיוחדים</th>
                <th className="text-right px-4 py-3">הערות</th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.date}</td>
                  <td className="px-4 py-3 text-slate-600">{r.meal_type}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{r.total_count}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {[
                      r.vegan_count > 0 && `טבעוני:${r.vegan_count}`,
                      r.vegetarian_count > 0 && `צמחוני:${r.vegetarian_count}`,
                      r.lactose_free_count > 0 && `לקטוז:${r.lactose_free_count}`,
                      r.gluten_free_count > 0 && `גלוטן:${r.gluten_free_count}`,
                    ].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.notes || '—'}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Demand Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="יצירת דרישת מזון">
        <div className="space-y-4">
          {demand && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              הדרישה תיווצר לפי הסד"כ הנוכחי: <strong>{demand.total} לוחמים</strong>
            </div>
          )}
          <div>
            <label className="label">תאריך</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">ארוחה</label>
            <select className="select" value={form.meal_type} onChange={e => setForm(p => ({ ...p, meal_type: e.target.value }))}>
              {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="הערות נוספות..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">{saving ? 'יוצר...' : 'יצירה'}</button>
            <button onClick={() => setModal(false)} className="btn-secondary">ביטול</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={detailModal ? `רשימת ${detailModal.title}` : ''} size="md">
        {detailModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{detailModal.soldiers.length} לוחמים</span>
              <div className="flex gap-2">
                <button onClick={() => exportListToExcel(detailModal.soldiers, detailModal.title)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Excel
                </button>
                <button onClick={() => exportListToPdf(detailModal.soldiers, detailModal.title)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  PDF
                </button>
              </div>
            </div>
            {detailModal.soldiers.length === 0 ? (
              <p className="text-center text-slate-400 py-6">אין לוחמים בקטגוריה זו</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {detailModal.soldiers.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{s.full_name}</div>
                      <div className="text-xs text-slate-400">{s.company ? `פלוגה ${s.company}` : ''} · {s.team}</div>
                    </div>
                    <div className="text-sm text-slate-500 font-mono">{s.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
