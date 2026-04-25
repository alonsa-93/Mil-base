import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await login(username, password);
      if (res.requireOtp) setStep('otp');
    } catch (err) {
      const errData = err.response?.data?.error;
      const errorMsg = typeof errData === 'string' ? errData : (errData?.message || 'שגיאת התחברות');
      setError(errorMsg);
    } finally { setLoading(false); }
  }

  async function handleOtp(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await verifyOtp(username, otp);
    } catch (err) {
      const errData = err.response?.data?.error;
      const errorMsg = typeof errData === 'string' ? errData : (errData?.message || 'קוד שגוי');
      setError(errorMsg);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a3050 50%, #0f1f38 100%)' }}>

      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

      <div className="w-full max-w-md animate-slide-up relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-18 h-18 rounded-2xl mb-5"
            style={{
              width: '72px', height: '72px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              boxShadow: '0 4px 0 #1e40af, 0 8px 24px rgba(59,130,246,0.5)',
            }}>
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Mil<span className="text-blue-400">&</span>Base
          </h1>
          <p className="text-blue-200/50 mt-2 text-sm font-medium">מערכת ניהול אופרטיבי</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-blue-100/70 mb-1.5">שם משתמש</label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="magad1" required autoFocus
                  onFocus={e => { e.target.style.border = '1px solid rgba(59,130,246,0.7)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
                  onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-100/70 mb-1.5">סיסמה</label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  onFocus={e => { e.target.style.border = '1px solid rgba(59,130,246,0.7)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
                  onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 3px 0 #1e40af, 0 6px 20px rgba(59,130,246,0.4)' }}
                onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.target.style.transform = ''; }}>
                {loading ? 'מתחבר...' : 'כניסה למערכת'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="space-y-5">
              <div className="text-center mb-2">
                <div className="text-blue-200/60 text-sm">קוד OTP נשלח לטלפון שלך</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-100/70 mb-1.5">קוד אימות (6 ספרות)</label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-white text-center text-2xl tracking-widest font-mono transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="000000" maxLength={6} required autoFocus
                />
              </div>
              {error && (
                <div className="px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm">{error}</div>
              )}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-white text-base"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 3px 0 #1e40af, 0 6px 20px rgba(59,130,246,0.4)' }}>
                {loading ? 'מאמת...' : 'אימות'}
              </button>
              <button type="button" onClick={() => setStep('login')}
                className="w-full py-2.5 rounded-xl text-sm text-blue-200/50 hover:text-blue-200 transition-colors">
                חזרה לכניסה
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-white/30 text-xs text-center mb-2">משתמשי דמו (סיסמה: 1234)</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['magad1', 'mefaked1', 'rasap1', 'samal1', 'lohem1'].map(u => (
                <button key={u} type="button" onClick={() => { setUsername(u); setPassword('1234'); }}
                  className="text-xs px-3 py-1.5 rounded-lg text-white/40 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
