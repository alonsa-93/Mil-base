import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { isMagad } from '../utils/rbac';
import Modal from '../components/shared/Modal';

const ROLES = ['lohem', 'samal', 'rasap', 'mefaked', 'magad'];
const ROLE_LABELS = { lohem: 'לוחם', samal: 'סמל', rasap: 'רס"פ', mefaked: 'מפקד', magad: 'מג"ד' };
const ROLE_COLORS = { lohem: 'badge-gray', samal: 'badge-blue', rasap: 'badge-green', mefaked: 'badge-yellow', magad: 'badge-red' };

const defaultForm = { username: '', password: '', full_name: '', role: 'lohem', phone: '' };

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canDelete = isMagad(user?.role);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    const res = await axios.get('/api/users');
    setUsers(res.data);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      if (modal === 'add') {
        await axios.post('/api/users', form);
      } else {
        const payload = { full_name: form.full_name, role: form.role, phone: form.phone };
        if (form.password) payload.password = form.password;
        await axios.put(`/api/users/${editUser.id}`, payload);
      }
      await fetchUsers();
      setModal(null);
    } catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
    finally { setSaving(false); }
  }

  async function handleDelete(u) {
    if (!confirm(`למחוק את ${u.full_name}?`)) return;
    await axios.delete(`/api/users/${u.id}`);
    setUsers(prev => prev.filter(x => x.id !== u.id));
  }

  function openAdd() { setForm(defaultForm); setEditUser(null); setError(''); setModal('add'); }
  function openEdit(u) { setForm({ ...u, password: '' }); setEditUser(u); setError(''); setModal('edit'); }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ניהול משתמשים</h1>
          <p className="text-slate-500 text-sm">{users.length} משתמשים</p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          משתמש חדש
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center h-32 items-center">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                <th className="text-right px-4 py-3">שם</th>
                <th className="text-right px-4 py-3">משתמש</th>
                <th className="text-right px-4 py-3">הרשאה</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">טלפון</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3"><span className={ROLE_COLORS[u.role] || 'badge-gray'}>{ROLE_LABELS[u.role]}</span></td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {canDelete && u.id !== user.id && (
                        <button onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'משתמש חדש' : 'עריכת משתמש'}>
        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input className="input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          {modal === 'add' && (
            <div>
              <label className="label">שם משתמש *</label>
              <input className="input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">{modal === 'add' ? 'סיסמה *' : 'סיסמה חדשה (ריק = ללא שינוי)'}</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div>
            <label className="label">טלפון</label>
            <input className="input" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">הרשאה</label>
            <select className="select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'שומר...' : 'שמירה'}</button>
            <button onClick={() => setModal(null)} className="btn-secondary">ביטול</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
