import { useState } from 'react';
import { apiSend } from '../../api';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass, SegmentedControl } from '../ui/Form';
import ForgotPasswordForm from './ForgotPasswordForm';

const DEMO_ACCOUNTS = [
  { email: 'admin@test.com', label: 'Administrator' },
  { email: 'staff@test.com', label: 'Staff' },
  { email: 'ton@test.com', label: 'Member' },
  { email: 'gift@test.com', label: 'Member' }
];

const FEATURES = [
  { icon: 'chat', text: 'แชทแบบเรียลไทม์' },
  { icon: 'board', text: 'Project พร้อมบอร์ดงานแบบลากวาง' },
  { icon: 'shield', text: 'กำหนด Role และสิทธิ์ในกลุ่มได้เอง' }
];

function submitLabel(loading, mode) {
  if (loading) return 'กำลังดำเนินการ...';
  if (mode === 'login') return 'เข้าสู่ระบบ';
  return 'สมัครสมาชิก';
}

export default function LoginView({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const changeMode = (value) => {
    setMode(value);
    setError('');
    setSuccess('');
  };

  const handleResetDone = (resetEmail, message) => {
    setMode('login');
    setEmail(resetEmail);
    setPassword('');
    setError('');
    setSuccess(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) {
        setError('กรุณากรอกชื่อ');
        return;
      }
      if (password !== confirm) {
        setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await apiSend('POST', '/users/login', { email: email, password: password });
        onLogin(data.user, data.token);
      } else {
        const data = await apiSend('POST', '/users/register', { name: name, email: email, password: password });
        onLogin(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword('123456');
    setError('');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-indigo-600 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute bottom-10 -left-20 w-72 h-72 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="chat" className="w-6 h-6" />
          </span>
          <span className="text-lg font-semibold">Realtime Chat</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">ทำงานเป็นทีม<br />คุยกันได้ทันที</h1>
          <p className="text-indigo-100 mt-4 text-base">รวมแชท โปรเจกต์ และบอร์ดงานไว้ในที่เดียว</p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(item => (
              <li key={item.text} className="flex items-center gap-3 text-indigo-50">
                <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon name={item.icon} className="w-5 h-5" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-indigo-200">ลองใช้กันเลย </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-sm">
          {mode === 'forgot' ? (
            <ForgotPasswordForm onBack={() => changeMode('login')} onDone={handleResetDone} />
          ) : (
          <>
          <h2 className="text-2xl font-semibold text-slate-900">
            {mode === 'login' ? 'ยินดีต้อนรับกลับมา' : 'สร้างบัญชีใหม่'}
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {mode === 'login' ? 'เข้าสู่ระบบเพื่อคุยกับทีมของคุณ' : 'ใช้เวลาไม่ถึงนาที'}
          </p>

          <div className="mb-6">
            <SegmentedControl
              value={mode}
              onChange={changeMode}
              options={[
                { value: 'login', label: 'เข้าสู่ระบบ' },
                { value: 'register', label: 'สมัครสมาชิก' }
              ]}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Field label="ชื่อที่แสดง">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="" maxLength={50} />
              </Field>
            )}
            <Field label="อีเมล">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="รหัสผ่าน">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Field>
            {mode === 'login' && (
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={() => changeMode('forgot')} className="text-sm text-indigo-600 hover:underline">ลืมรหัสผ่าน?</button>
              </div>
            )}
            {mode === 'register' && (
              <Field label="ยืนยันรหัสผ่าน">
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
              </Field>
            )}

            {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</p>}
            <ErrorBox message={error} />

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {submitLabel(loading, mode)}
            </Button>
          </form>
          </>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-3">บัญชีทดสอบ (รหัสผ่าน 123456)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(account => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account.email)}
                  className="text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-800">{account.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{account.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
