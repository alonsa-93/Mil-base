import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDateTime } from '../utils/dateUtils';

const ROLE_LABELS = { lohem: 'לוחם', samal: 'סמל', rasap: 'רס"פ', mefaked: 'מפקד', magad: 'מג"ד' };

function hebrewStr(val) {
  if (val == null) return '—';
  const s = String(val);
  return s || '—';
}

function exportToExcel(data, columns, filename, sheetName = 'נתונים') {
  import('xlsx').then(XLSX => {
    const rows = data.map(row => columns.map(c => {
      const v = row[c.key];
      return c.transform ? c.transform(v) : (v ?? '');
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([columns.map(c => c.header), ...rows]);
    ws['!cols'] = columns.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  });
}

async function exportToPdf(title, columns, data, filename) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('he-IL');

  // Write title (ASCII-safe — Hebrew won't render in standard helvetica)
  doc.setFontSize(12);
  doc.text(`${filename} — ${today}`, doc.internal.pageSize.width - 15, 15, { align: 'right' });

  const body = data.length === 0
    ? [columns.map(() => '—')]
    : data.map(row => columns.map(c => {
      const v = row[c.key];
      const str = c.transform ? c.transform(v) : hebrewStr(v);
      return str;
    }));

  autoTable(doc, {
    head: [columns.map(c => c.header)],
    body,
    styles: { halign: 'right', fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175], halign: 'right', textColor: 255, fontStyle: 'bold' },
    margin: { top: 25, right: 15, left: 15 },
    startY: 25,
    didParseCell(data) {
      // Force RTL rendering direction hack
      data.cell.styles.halign = 'right';
    },
  });
  doc.save(`${filename}.pdf`);
}

const REPORT_TYPES = [
  { key: 'soldiers', label: 'סד"כ' },
  { key: 'missions', label: 'משימות' },
  { key: 'equipment', label: 'ציוד' },
  { key: 'rations', label: 'הזנה' },
];

const COLUMNS = {
  soldiers: [
    { key: 'serial_num', header: 'מס"ד' },
    { key: 'full_name', header: 'שם מלא' },
    { key: 'personal_id', header: 'מספר אישי' },
    { key: 'company', header: 'פלוגה' },
    { key: 'team', header: 'צוות' },
    { key: 'role', header: 'תפקיד', transform: v => ROLE_LABELS[v] || v || '—' },
    { key: 'phone', header: 'טלפון' },
    { key: 'status', header: 'סטטוס' },
    { key: 'mil_shirt', header: 'חולצה' },
    { key: 'mil_pants', header: 'מכנס' },
    { key: 'mil_boots', header: 'נעליים' },
  ],
  missions: [
    { key: 'title', header: 'משימה' },
    { key: 'type', header: 'סוג' },
    { key: 'status', header: 'סטטוס' },
    { key: 'urgency', header: 'דחיפות' },
    { key: 'location', header: 'מיקום' },
    { key: 'start_time', header: 'התחלה', transform: v => v ? new Date(v).toLocaleDateString('he-IL') : '—' },
    { key: 'end_time', header: 'סיום', transform: v => v ? new Date(v).toLocaleDateString('he-IL') : '—' },
    { key: 'required_count', header: 'נדרש' },
  ],
  equipment: [
    { key: 'name', header: 'פריט' },
    { key: 'category', header: 'קטגוריה' },
    { key: 'total_quantity', header: 'כולל' },
    { key: 'available_quantity', header: 'זמין' },
    { key: 'min_required', header: 'מינימום' },
  ],
  rations: [
    { key: 'date', header: 'תאריך' },
    { key: 'meal_type', header: 'ארוחה' },
    { key: 'total_count', header: 'סה"כ' },
    { key: 'vegan_count', header: 'טבעוני' },
    { key: 'vegetarian_count', header: 'צמחוני' },
    { key: 'lactose_free_count', header: 'ללא לקטוז' },
    { key: 'gluten_free_count', header: 'ללא גלוטן' },
  ],
};

export default function Reports() {
  const [type, setType] = useState('soldiers');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchData(); }, [type]);

  async function fetchData() {
    setLoading(true);
    try {
      const endpoints = { soldiers: '/api/soldiers', missions: '/api/missions', equipment: '/api/equipment/items', rations: '/api/rations' };
      const res = await axios.get(endpoints[type]);
      setData(res.data);
    } finally { setLoading(false); }
  }

  const filteredData = data.filter(row => !filterStatus || row.status === filterStatus);
  const columns = COLUMNS[type];
  const label = REPORT_TYPES.find(r => r.key === type)?.label;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">דוחות</h1>
        <p className="text-slate-500 text-sm">ייצוא נתונים ל-Excel ו-PDF</p>
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map(r => (
          <button key={r.key} onClick={() => { setType(r.key); setFilterStatus(''); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${type === r.key
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {(type === 'soldiers' || type === 'missions') && (
          <select className="select text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">כל הסטטוסים</option>
            {type === 'soldiers'
              ? ['זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר'].map(s => <option key={s} value={s}>{s}</option>)
              : ['מתוכנן', 'פעיל', 'הסתיים', 'בוטל'].map(s => <option key={s} value={s}>{s}</option>)
            }
          </select>
        )}
        <div className="flex-1" />
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(filteredData, columns, `milbase_${type}_${today}`, label)}
            className="btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            ייצוא Excel
          </button>
          <button onClick={() => exportToPdf(`דוח ${label}`, columns, filteredData, `milbase_${type}_${today}`)}
            className="btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            ייצוא PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-sm text-slate-500 font-medium">
          {loading ? 'טוען...' : `${filteredData.length} רשומות`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold bg-slate-50">
                {columns.map(c => <th key={c.key} className="text-right px-4 py-3 whitespace-nowrap">{c.header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={columns.length} className="text-center py-8 text-slate-400">טוען...</td></tr>}
              {!loading && filteredData.length === 0 && <tr><td colSpan={columns.length} className="text-center py-8 text-slate-400">אין נתונים להצגה</td></tr>}
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                  {columns.map(c => (
                    <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {c.transform ? c.transform(row[c.key]) : (c.key.includes('time') ? formatDateTime(row[c.key]) : hebrewStr(row[c.key]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
