import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../utils/rbac';

const MIL_SIZES = ['ק', 'ב', 'ג', 'מ', 'ממ'];
const CIVIL_SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CIVIL_PANTS_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const BOOT_SIZES = Array.from({ length: 16 }, (_, i) => String(35 + i));
const STATUSES = ['זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר'];
const ROLES = ['lohem', 'samal', 'rasap', 'mefaked', 'magad'];
const ROLE_LABELS = { lohem: 'לוחם', samal: 'סמל', rasap: 'רס"פ', mefaked: 'מפקד', magad: 'מג"ד' };
const COMPANIES = ['א', 'ב', 'ג'];
const GENDERS = ['זכר', 'נקבה', 'אחר'];
const STATUS_COLORS = {
  'זמין': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'במשימה': 'bg-blue-100 text-blue-700 border-blue-200',
  'מנוחה': 'bg-amber-100 text-amber-700 border-amber-200',
  'חופשה': 'bg-purple-100 text-purple-700 border-purple-200',
  'אחר': 'bg-slate-100 text-slate-600 border-slate-200',
};

const defaultForm = {
  personal_id: '', full_name: '', role: 'lohem', status: 'זמין', phone: '',
  company: 'א', team: '', gender: 'זכר',
  mil_shirt: 'מ', mil_pants: 'מ', mil_boots: '42',
  civil_shirt: 'M', civil_pants: 'M',
  is_vegan: 0, is_vegetarian: 0, lactose_intolerant: 0, gluten_free: 0, nutrition_notes: '',
};

// Required label marker (must be defined at module scope, NOT inside the component,
// otherwise React creates a new component instance every render and remounts inputs,
// which causes the input to lose focus after every keystroke).
const Req = () => <span className="text-red-500 mr-0.5">*</span>;

function exportToExcel(soldiers) {
  import('xlsx').then(XLSX => {
    const headers = ['מס"ד', 'שם מלא', 'מספר אישי', 'פלוגה', 'צוות', 'תפקיד', 'טלפון', 'סטטוס', 'מין', 'חולצה צבאית', 'מכנס צבאי', 'נעליים', 'חולצה אזרחית', 'מכנס אזרחי', 'טבעוני', 'צמחוני', 'ללא לקטוז', 'ללא גלוטן'];
    const rows = soldiers.map(s => [
      s.serial_num, s.full_name, s.personal_id, s.company, s.team,
      ROLE_LABELS[s.role] || s.role, s.phone, s.status, s.gender || 'זכר',
      s.mil_shirt, s.mil_pants, s.mil_boots,
      s.civil_shirt || '', s.civil_pants || '',
      s.is_vegan ? 'כן' : 'לא', s.is_vegetarian ? 'כן' : 'לא',
      s.lactose_intolerant ? 'כן' : 'לא', s.gluten_free ? 'כן' : 'לא',
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws, 'סד"כ');
    XLSX.writeFile(wb, `soldiers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

async function exportToPdf(soldiers) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('he-IL');

  const headers = ['מס"ד', 'שם מלא', 'מספר אישי', 'פלוגה', 'צוות', 'תפקיד', 'טלפון', 'סטטוס'];
  const body = soldiers.map(s => [
    s.serial_num, s.full_name, s.personal_id, s.company, s.team,
    ROLE_LABELS[s.role] || s.role, s.phone, s.status,
  ]);

  doc.setFontSize(14);
  doc.text(`\u05E1\u05D3"\u05DB \u05D7\u05D9\u05D9\u05DC\u05D9\u05DD \u2014 ${today}`, doc.internal.pageSize.width - 15, 15, { align: 'right' });

  autoTable(doc, {
    head: [headers],
    body: body.length ? body : [['אין נתונים']],
    styles: { halign: 'right', fontSize: 9, font: 'helvetica' },
    headStyles: { fillColor: [30, 64, 175], halign: 'right', textColor: 255 },
    margin: { top: 25, right: 15, left: 15 },
    startY: 25,
  });
  doc.save(`soldiers_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function importFromExcel(file, onSuccess) {
  import('xlsx').then(XLSX => {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Skip header row
      const soldiers = rows.slice(1).filter(r => r[1]).map(r => ({
        full_name: r[1] || '',
        personal_id: String(r[2] || ''),
        company: r[3] || 'א',
        team: r[4] || '',
        role: Object.entries(ROLE_LABELS).find(([, v]) => v === r[5])?.[0] || 'lohem',
        phone: String(r[6] || ''),
        status: r[7] || 'זמין',
        gender: r[8] || 'זכר',
        mil_shirt: r[9] || 'מ',
        mil_pants: r[10] || 'מ',
        mil_boots: String(r[11] || '42'),
        civil_shirt: r[12] || '',
        civil_pants: r[13] || '',
        is_vegan: r[14] === 'כן' ? 1 : 0,
        is_vegetarian: r[15] === 'כן' ? 1 : 0,
        lactose_intolerant: r[16] === 'כן' ? 1 : 0,
        gluten_free: r[17] === 'כן' ? 1 : 0,
      }));
      onSuccess(soldiers);
    };
    reader.readAsBinaryString(file);
  });
}

export default function Soldiers() {
  const { user } = useAuth();
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileRef = useRef();

  const canWrite = canEdit(user?.role);
  const canDelete = user?.role === 'mefaked' || user?.role === 'magad';

  useEffect(() => { fetchSoldiers(); }, []);

  async function fetchSoldiers() {
    try {
      const res = await axios.get('/api/soldiers');
      setSoldiers(res.data);
    } finally { setLoading(false); }
  }

  function openAdd() { setForm(defaultForm); setSelected(null); setError(''); setModal('add'); }
  function openEdit(s, e) {
    e?.stopPropagation();
    setForm({
      ...defaultForm, ...s,
      is_vegan: s.is_vegan || 0, is_vegetarian: s.is_vegetarian || 0,
      lactose_intolerant: s.lactose_intolerant || 0, gluten_free: s.gluten_free || 0,
    });
    setSelected(s); setError(''); setModal('edit');
  }
  function openView(s) { setSelected(s); setModal('view'); }

  function validateForm() {
    const required = ['full_name', 'personal_id', 'phone', 'company', 'team', 'role', 'status'];
    for (const f of required) {
      if (!form[f]?.toString().trim()) return `שדה "${f}" הוא חובה`;
    }
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'add') {
        await axios.post('/api/soldiers', form);
      } else {
        await axios.put(`/api/soldiers/${selected.id}`, form);
      }
      await fetchSoldiers();
      setModal(null);
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה בשמירה');
    } finally { setSaving(false); }
  }

  async function handleDelete(s, e) {
    e?.stopPropagation();
    if (!confirm(`למחוק את ${s.full_name}?`)) return;
    try {
      await axios.delete(`/api/soldiers/${s.id}`);
      setSoldiers(prev => prev.filter(x => x.id !== s.id));
      setCheckedIds(prev => { const n = new Set(prev); n.delete(s.id); return n; });
    } catch (e) { alert(e.response?.data?.error || 'שגיאה'); }
  }

  async function handleBulkDelete() {
    if (!checkedIds.size) return;
    if (!confirm(`למחוק ${checkedIds.size} לוחמים?`)) return;
    try {
      await axios.delete('/api/soldiers/bulk', { data: { ids: [...checkedIds] } });
      setSoldiers(prev => prev.filter(x => !checkedIds.has(x.id)));
      setCheckedIds(new Set());
    } catch (e) { alert(e.response?.data?.error || 'שגיאה'); }
  }

  async function handleBulkStatus() {
    if (!checkedIds.size || !bulkStatus) return;
    try {
      await axios.put('/api/soldiers/bulk/status', { ids: [...checkedIds], status: bulkStatus });
      setSoldiers(prev => prev.map(x => checkedIds.has(x.id) ? { ...x, status: bulkStatus } : x));
      setCheckedIds(new Set()); setBulkStatus('');
    } catch (e) { alert(e.response?.data?.error || 'שגיאה'); }
  }

  function toggleCheck(id, e) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map(s => s.id)));
    }
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportLoading(true);
    importFromExcel(file, async soldiers => {
      try {
        for (const s of soldiers) {
          await axios.post('/api/soldiers', s);
        }
        await fetchSoldiers();
        alert(`יובאו ${soldiers.length} לוחמים בהצלחה`);
      } catch (e) {
        alert('שגיאה בייבוא: ' + (e.response?.data?.error || e.message));
      } finally {
        setImportLoading(false);
        e.target.value = '';
      }
    });
  }

  const teams = [...new Set(soldiers.map(s => s.team).filter(Boolean))].sort();

  const filtered = soldiers.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.personal_id?.includes(q) ||
      s.phone?.includes(q) ||
      s.team?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || s.status === filterStatus;
    const matchCompany = !filterCompany || s.company === filterCompany;
    const matchTeam = !filterTeam || s.team === filterTeam;
    const matchRole = !filterRole || s.role === filterRole;
    return matchSearch && matchStatus && matchCompany && matchTeam && matchRole;
  });

  // Inline text input renderer — uses the parent's `form` and `setForm` closures
  // directly, so the underlying <input> element keeps its identity across
  // re-renders (no focus loss while typing).
  const renderInput = (name, placeholder = '') => (
    <input
      className="input"
      placeholder={placeholder}
      value={form[name] ?? ''}
      onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
    />
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">סד"כ</h1>
          <p className="text-slate-500 text-sm">{soldiers.length} לוחמים סה"כ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={importLoading}
                className="btn-secondary text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {importLoading ? 'מייבא...' : 'ייבוא Excel'}
              </button>
              <button onClick={() => exportToExcel(filtered)}
                className="btn-secondary text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Excel
              </button>
              <button onClick={() => exportToPdf(filtered)}
                className="btn-secondary text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                PDF
              </button>
              <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                הוספת לוחם
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input className="input pr-9 text-sm" placeholder="חיפוש שם, מספר אישי, טלפון, צוות..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {[
            { key: 'status', label: 'סטטוס', value: filterStatus, set: setFilterStatus, opts: STATUSES },
            { key: 'company', label: 'פלוגה', value: filterCompany, set: setFilterCompany, opts: COMPANIES },
            { key: 'team', label: 'צוות', value: filterTeam, set: setFilterTeam, opts: teams },
            { key: 'role', label: 'תפקיד', value: filterRole, set: setFilterRole, opts: ROLES, labels: ROLE_LABELS },
          ].map(f => (
            <select key={f.key} className="select text-sm w-auto min-w-[110px]" value={f.value} onChange={e => f.set(e.target.value)}>
              <option value="">{f.label} — הכל</option>
              {f.opts.map(o => <option key={o} value={o}>{f.labels ? f.labels[o] : o}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {checkedIds.size > 0 && (
        <div className="card p-3 bg-blue-50 border-blue-200 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-700">{checkedIds.size} נבחרו</span>
          <div className="flex items-center gap-2">
            <select className="select text-sm w-auto min-w-[120px] border-blue-300" value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
              <option value="">עדכון סטטוס...</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBulkStatus} disabled={!bulkStatus} className="btn-primary text-sm py-1.5 px-3">עדכן</button>
          </div>
          {canDelete && (
            <button onClick={handleBulkDelete} className="btn-danger text-sm py-1.5 px-3 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              מחיקת נבחרים
            </button>
          )}
          <button onClick={() => setCheckedIds(new Set())} className="btn-ghost text-sm py-1.5 px-3 text-slate-500">ביטול</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center h-32 items-center">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                  {canWrite && (
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox"
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        checked={filtered.length > 0 && checkedIds.size === filtered.length}
                        onChange={toggleAll} />
                    </th>
                  )}
                  <th className="text-right px-4 py-3">מס"ד</th>
                  <th className="text-right px-4 py-3">שם מלא</th>
                  <th className="text-right px-4 py-3">מספר אישי</th>
                  <th className="text-right px-4 py-3">פלוגה</th>
                  <th className="text-right px-4 py-3">צוות</th>
                  <th className="text-right px-4 py-3">תפקיד</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">טלפון</th>
                  <th className="text-right px-4 py-3">סטטוס</th>
                  {canWrite && <th className="px-4 py-3 w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-slate-400 py-12">אין נתונים להצגה</td></tr>
                )}
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => openView(s)}
                    className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${checkedIds.has(s.id) ? 'bg-blue-50' : ''}`}
                  >
                    {canWrite && (
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                          checked={checkedIds.has(s.id)}
                          onChange={e => toggleCheck(s.id, e)} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.serial_num}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{s.personal_id}</td>
                    <td className="px-4 py-3">
                      {s.company && (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
                          {s.company}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.team}</td>
                    <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[s.role] || s.role}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell font-mono text-xs">{s.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {s.status}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={e => openEdit(s, e)}
                            className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {canDelete && (
                            <button onClick={e => handleDelete(s, e)}
                              className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl animate-slide-up max-h-[92vh] flex flex-col rounded-2xl bg-white"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{modal === 'add' ? 'הוספת לוחם' : `עריכת ${selected?.full_name}`}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Basic info */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">פרטים אישיים</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label"><Req />שם מלא</label>
                    {renderInput('full_name', 'שם פרטי ושם משפחה')}
                  </div>
                  <div>
                    <label className="label"><Req />מספר אישי</label>
                    {renderInput('personal_id', '1234567')}
                  </div>
                  <div>
                    <label className="label"><Req />טלפון</label>
                    {renderInput('phone', '050-0000000')}
                  </div>
                  <div>
                    <label className="label"><Req />מין</label>
                    <select className="select" value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Unit info */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">שיבוץ יחידה</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label"><Req />פלוגה</label>
                    <select className="select" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}>
                      {COMPANIES.map(c => <option key={c} value={c}>פלוגה {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label"><Req />צוות</label>
                    {renderInput('team', 'מס׳ צוות')}
                  </div>
                  <div>
                    <label className="label"><Req />תפקיד</label>
                    <select className="select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label"><Req />סטטוס</label>
                    <select className="select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Military sizes */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">מידות צבאיות</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">חולצה</label>
                    <select className="select" value={form.mil_shirt || ''} onChange={e => setForm(p => ({ ...p, mil_shirt: e.target.value }))}>
                      {MIL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">מכנס</label>
                    <select className="select" value={form.mil_pants || ''} onChange={e => setForm(p => ({ ...p, mil_pants: e.target.value }))}>
                      {MIL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">נעליים</label>
                    <select className="select" value={form.mil_boots || '42'} onChange={e => setForm(p => ({ ...p, mil_boots: e.target.value }))}>
                      {BOOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Civilian sizes */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">מידות אזרחיות</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">חולצה</label>
                    <select className="select" value={form.civil_shirt || ''} onChange={e => setForm(p => ({ ...p, civil_shirt: e.target.value }))}>
                      <option value="">—</option>
                      {CIVIL_SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">מכנס</label>
                    <select className="select" value={form.civil_pants || ''} onChange={e => setForm(p => ({ ...p, civil_pants: e.target.value }))}>
                      <option value="">—</option>
                      {CIVIL_PANTS_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Nutrition */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">העדפות תזונה</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[['is_vegan', 'טבעוני'], ['is_vegetarian', 'צמחוני'], ['lactose_intolerant', 'ללא לקטוז'], ['gluten_free', 'ללא גלוטן']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                        checked={!!form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.checked ? 1 : 0 }))} />
                      <span className="text-sm text-slate-700">{l}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="label">הערות תזונה</label>
                  {renderInput('nutrition_notes', 'הערות נוספות')}
                </div>
              </section>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'שומר...' : 'שמירה'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.full_name}</h2>
                <p className="text-sm text-slate-400 font-mono">{selected.personal_id}</p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['פלוגה', `פלוגה ${selected.company || '—'}`],
                  ['צוות', selected.team || '—'],
                  ['תפקיד', ROLE_LABELS[selected.role] || selected.role],
                  ['מין', selected.gender || '—'],
                  ['טלפון', selected.phone || '—'],
                  ['מס"ד', selected.serial_num],
                ].map(([l, v]) => (
                  <div key={l} className="bg-slate-50 rounded-xl p-3">
                    <div className="text-xs text-slate-400 font-medium">{l}</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">סטטוס:</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[selected.status] || ''}`}>
                  {selected.status}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">מידות צבאיות</div>
                <div className="flex gap-4 text-sm text-slate-700">
                  <span>חולצה: <strong>{selected.mil_shirt || '—'}</strong></span>
                  <span>מכנס: <strong>{selected.mil_pants || '—'}</strong></span>
                  <span>נעליים: <strong>{selected.mil_boots || '—'}</strong></span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">מידות אזרחיות</div>
                <div className="flex gap-4 text-sm text-slate-700">
                  <span>חולצה: <strong>{selected.civil_shirt || '—'}</strong></span>
                  <span>מכנס: <strong>{selected.civil_pants || '—'}</strong></span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.is_vegan ? <span className="badge-green">טבעוני</span> : null}
                {selected.is_vegetarian ? <span className="badge-green">צמחוני</span> : null}
                {selected.lactose_intolerant ? <span className="badge-yellow">ללא לקטוז</span> : null}
                {selected.gluten_free ? <span className="badge-yellow">ללא גלוטן</span> : null}
                {!selected.is_vegan && !selected.is_vegetarian && !selected.lactose_intolerant && !selected.gluten_free &&
                  <span className="badge-gray">תזונה רגילה</span>}
              </div>
            </div>
            {canWrite && (
              <div className="px-6 pb-5">
                <button onClick={e => openEdit(selected, e)} className="btn-secondary w-full">עריכה</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
