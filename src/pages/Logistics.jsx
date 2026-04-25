import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { canManageLogistics } from '../utils/rbac';
import Modal from '../components/shared/Modal';

const CATEGORIES = ['ציוד מגן', 'נשק', 'תקשורת', 'לוגיסטיקה', 'רפואה', 'אחר'];

const EQ_STATUS = {
  missing: { label: 'חסר', color: 'bg-red-100 text-red-700 border-red-200', dot: '🔴' },
  issued: { label: 'נמסר', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: '🟢' },
  returned: { label: 'הוזדכה', color: 'bg-slate-100 text-slate-500 border-slate-200', dot: '⚪' },
};
const EQ_CYCLE = { missing: 'issued', issued: 'returned', returned: 'missing' };

export default function Logistics() {
  const { user } = useAuth();
  const [tab, setTab] = useState('inventory');
  const [items, setItems] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [soldierEquipment, setSoldierEquipment] = useState([]); // for issuance tab
  const [loading, setLoading] = useState(true);
  const [eqLoading, setEqLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [eqSearch, setEqSearch] = useState('');
  const [eqFilter, setEqFilter] = useState(''); // item key to filter by
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'ציוד מגן', total_quantity: 0, available_quantity: 0, min_required: 0, unit_of_measure: 'יחידה' });
  const [issueForm, setIssueForm] = useState({ soldier_id: '', item_id: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canWrite = canManageLogistics(user?.role);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [i, a, g, s] = await Promise.all([
      axios.get('/api/equipment/items'),
      axios.get('/api/equipment/assignments'),
      axios.get('/api/equipment/gaps'),
      axios.get('/api/soldiers'),
    ]);
    setItems(i.data); setAssignments(a.data); setGaps(g.data); setSoldiers(s.data);
    setLoading(false);
  }

  async function fetchSoldierEquipment() {
    setEqLoading(true);
    try {
      const res = await axios.get('/api/equipment/soldier/all');
      setSoldierEquipment(res.data);
    } finally { setEqLoading(false); }
  }

  useEffect(() => {
    if (tab === 'issuance' && soldierEquipment.length === 0) {
      fetchSoldierEquipment();
    }
  }, [tab]);

  async function updateEquipmentStatus(soldierId, itemType, currentStatus) {
    const newStatus = EQ_CYCLE[currentStatus];
    // Optimistic update
    setSoldierEquipment(prev => prev.map(s =>
      s.id === soldierId
        ? { ...s, equipment: s.equipment.map(e => e.item_type === itemType ? { ...e, status: newStatus } : e) }
        : s
    ));
    try {
      await axios.put(`/api/equipment/soldier/${soldierId}/${itemType}`, { status: newStatus });
    } catch {
      // revert
      setSoldierEquipment(prev => prev.map(s =>
        s.id === soldierId
          ? { ...s, equipment: s.equipment.map(e => e.item_type === itemType ? { ...e, status: currentStatus } : e) }
          : s
      ));
    }
  }

  async function handleSaveItem() {
    setSaving(true); setError('');
    if (!form.name?.trim()) { setError('שם הפריט חובה'); setSaving(false); return; }
    try {
      await axios.post('/api/equipment/items', {
        ...form,
        total_quantity: +form.total_quantity,
        available_quantity: +form.available_quantity,
        min_required: +form.min_required,
      });
      await fetchAll(); setModal(null);
    } catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
    finally { setSaving(false); }
  }

  async function handleIssue() {
    setSaving(true); setError('');
    try {
      await axios.post('/api/equipment/issue', { ...issueForm, quantity: +issueForm.quantity });
      await fetchAll(); setModal(null);
    } catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
    finally { setSaving(false); }
  }

  async function handleReturn(id) {
    await axios.post(`/api/equipment/return/${id}`);
    await fetchAll();
  }

  async function deleteItem(id) {
    if (!confirm('למחוק פריט?')) return;
    await axios.delete(`/api/equipment/items/${id}`);
    await fetchAll();
  }

  const filteredItems = items.filter(i => {
    const q = search.toLowerCase();
    return (!q || i.name.toLowerCase().includes(q)) && (!filterCat || i.category === filterCat);
  });

  const filteredAssignments = assignments.filter(a => a.status === 'הונפק');

  const filteredSoldierEquipment = soldierEquipment.filter(s => {
    const q = eqSearch.toLowerCase();
    const matchSearch = !q || s.full_name?.toLowerCase().includes(q) || s.personal_id?.includes(q);
    const matchFilter = !eqFilter || s.equipment?.some(e => e.item_type === eqFilter && e.status === 'missing');
    return matchSearch && matchFilter;
  });

  // All unique equipment item types from first soldier
  const eqItemTypes = soldierEquipment[0]?.equipment || [];

  const TABS = [
    ['inventory', 'מלאי'],
    ['assignments', 'הנפקות'],
    ['issuance', 'ציוד אישי'],
    ['gaps', 'פערים'],
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">לוגיסטיקה</h1>
          <p className="text-slate-500 text-sm">{gaps.length > 0 ? `${gaps.length} פערים פעילים` : 'כל הציוד תקין'}</p>
        </div>
        <div className="flex gap-2">
          {canWrite && tab === 'inventory' && (
            <button
              onClick={() => {
                setForm({ name: '', category: 'ציוד מגן', total_quantity: 0, available_quantity: 0, min_required: 0, unit_of_measure: 'יחידה' });
                setError('');
                setModal('addItem');
              }}
              className="btn-primary text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              פריט חדש
            </button>
          )}
          {canWrite && tab === 'assignments' && (
            <button onClick={() => { setIssueForm({ soldier_id: '', item_id: '', quantity: 1 }); setError(''); setModal('issue'); }}
              className="btn-primary text-sm">הנפקת ציוד</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${tab === k ? 'text-blue-600 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-800'}`}>
            {l}
            {k === 'gaps' && gaps.length > 0 && (
              <span className="mr-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{gaps.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Inventory */}
          {tab === 'inventory' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input className="input pr-9 text-sm" placeholder="חיפוש פריט..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="select text-sm w-auto min-w-[130px]" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="">כל הקטגוריות</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                      <th className="text-right px-4 py-3">פריט</th>
                      <th className="text-right px-4 py-3">קטגוריה</th>
                      <th className="text-right px-4 py-3">זמין</th>
                      <th className="text-right px-4 py-3">סה"כ</th>
                      <th className="text-right px-4 py-3">מינימום</th>
                      <th className="text-right px-4 py-3">סטטוס</th>
                      {canWrite && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">אין נתונים להצגה</td></tr>}
                    {filteredItems.map(i => {
                      const isGap = i.available_quantity < i.min_required;
                      return (
                        <tr key={i.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">{i.name}</td>
                          <td className="px-4 py-3 text-slate-500">{i.category}</td>
                          <td className={`px-4 py-3 font-bold ${isGap ? 'text-red-600' : 'text-emerald-600'}`}>{i.available_quantity}</td>
                          <td className="px-4 py-3 text-slate-500">{i.total_quantity}</td>
                          <td className="px-4 py-3 text-slate-500">{i.min_required}</td>
                          <td className="px-4 py-3">
                            {isGap
                              ? <span className="badge-red">חוסר</span>
                              : <span className="badge-green">תקין</span>}
                          </td>
                          {canWrite && (
                            <td className="px-4 py-3">
                              <button onClick={() => deleteItem(i.id)}
                                className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Assignments */}
          {tab === 'assignments' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                    <th className="text-right px-4 py-3">חייל</th>
                    <th className="text-right px-4 py-3">פריט</th>
                    <th className="text-right px-4 py-3">כמות</th>
                    <th className="text-right px-4 py-3">סטטוס</th>
                    {canWrite && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-10">אין הנפקות פעילות</td></tr>}
                  {filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{a.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{a.item_name}</td>
                      <td className="px-4 py-3 text-slate-500">{a.quantity}</td>
                      <td className="px-4 py-3"><span className="badge-yellow">{a.status}</span></td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <button onClick={() => handleReturn(a.id)} className="btn-secondary text-xs py-1 px-2">החזרה</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Soldier Equipment Issuance */}
          {tab === 'issuance' && (
            <div className="space-y-4">
              {/* Quick filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input className="input pr-9 text-sm" placeholder="חיפוש חייל..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} />
                </div>
                <select className="select text-sm w-auto min-w-[160px]" value={eqFilter} onChange={e => setEqFilter(e.target.value)}>
                  <option value="">הצג הכל</option>
                  {eqItemTypes.map(e => (
                    <option key={e.item_type} value={e.item_type}>חסר: {e.label}</option>
                  ))}
                </select>
                {eqFilter && <button onClick={() => setEqFilter('')} className="btn-ghost text-sm text-slate-500 py-1.5 px-3">נקה</button>}
              </div>

              {eqLoading ? (
                <div className="flex justify-center h-32 items-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSoldierEquipment.length === 0 && (
                    <div className="card p-8 text-center text-slate-400">אין נתונים להצגה</div>
                  )}
                  {filteredSoldierEquipment.map(soldier => {
                    const missingCount = soldier.equipment?.filter(e => e.status === 'missing').length || 0;
                    return (
                      <div key={soldier.id} className="card overflow-hidden">
                        <div className={`px-4 py-3 border-b flex items-center justify-between ${missingCount > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                              {soldier.full_name?.[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{soldier.full_name}</div>
                              <div className="text-xs text-slate-400">{soldier.personal_id} · {soldier.company ? `פלוגה ${soldier.company}` : ''} · {soldier.team}</div>
                            </div>
                          </div>
                          {missingCount > 0 && (
                            <span className="badge-red">{missingCount} חסרים</span>
                          )}
                          {missingCount === 0 && (
                            <span className="badge-green">הציוד תקין</span>
                          )}
                        </div>
                        <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {soldier.equipment?.map(eq => {
                            const st = EQ_STATUS[eq.status] || EQ_STATUS.missing;
                            return (
                              <button
                                key={eq.item_type}
                                onClick={() => canWrite && updateEquipmentStatus(soldier.id, eq.item_type, eq.status)}
                                disabled={!canWrite}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${st.color} ${canWrite ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
                              >
                                <span className="text-base">{st.dot}</span>
                                <div className="text-right">
                                  <div className="text-xs font-semibold leading-tight">{eq.label}</div>
                                  <div className="text-xs opacity-70">{st.label}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Gaps */}
          {tab === 'gaps' && (
            <div className="space-y-3">
              {gaps.length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-slate-700 font-semibold text-lg">כל הציוד עומד במינימום הנדרש</p>
                  <p className="text-slate-400 text-sm mt-1">אין פערים פעילים</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                        <th className="text-right px-4 py-3">פריט</th>
                        <th className="text-right px-4 py-3">קטגוריה</th>
                        <th className="text-right px-4 py-3">זמין</th>
                        <th className="text-right px-4 py-3">נדרש</th>
                        <th className="text-right px-4 py-3">פער</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {gaps.map(g => (
                        <tr key={g.id} className="hover:bg-red-50/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">{g.name}</td>
                          <td className="px-4 py-3 text-slate-500">{g.category}</td>
                          <td className="px-4 py-3 text-red-600 font-bold">{g.available_quantity}</td>
                          <td className="px-4 py-3 text-slate-500">{g.min_required}</td>
                          <td className="px-4 py-3"><span className="badge-red">-{g.gap}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Item Modal */}
      <Modal open={modal === 'addItem'} onClose={() => setModal(null)} title="הוספת פריט ציוד">
        <div className="space-y-4">
          <div>
            <label className="label">שם הפריט *</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="שם הפריט" />
          </div>
          <div>
            <label className="label">קטגוריה</label>
            <select className="select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['כמות כוללת', 'total_quantity'], ['כמות זמינה', 'available_quantity'], ['מינימום', 'min_required']].map(([l, k]) => (
              <div key={k}>
                <label className="label">{l}</label>
                <input type="number" min="0" className="input" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSaveItem} disabled={saving} className="btn-primary flex-1">{saving ? 'שומר...' : 'הוספה'}</button>
            <button onClick={() => setModal(null)} className="btn-secondary">ביטול</button>
          </div>
        </div>
      </Modal>

      {/* Issue Modal */}
      <Modal open={modal === 'issue'} onClose={() => setModal(null)} title="הנפקת ציוד">
        <div className="space-y-4">
          <div>
            <label className="label">חייל</label>
            <select className="select" value={issueForm.soldier_id} onChange={e => setIssueForm(p => ({ ...p, soldier_id: e.target.value }))}>
              <option value="">בחר חייל</option>
              {soldiers.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.personal_id})</option>)}
            </select>
          </div>
          <div>
            <label className="label">פריט</label>
            <select className="select" value={issueForm.item_id} onChange={e => setIssueForm(p => ({ ...p, item_id: e.target.value }))}>
              <option value="">בחר פריט</option>
              {items.filter(i => i.available_quantity > 0).map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.available_quantity} זמינים)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">כמות</label>
            <input type="number" min={1} className="input" value={issueForm.quantity} onChange={e => setIssueForm(p => ({ ...p, quantity: e.target.value }))} />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleIssue} disabled={saving} className="btn-primary flex-1">{saving ? 'מנפיק...' : 'הנפקה'}</button>
            <button onClick={() => setModal(null)} className="btn-secondary">ביטול</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
