import { useState } from 'react';
import { apiSend } from '../../api';
import Button from '../ui/Button';
import { Field, ErrorBox, inputClass } from '../ui/Form';

export default function ForgotPasswordForm({ onBack, onDone }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiSend('POST', '/users/forgot-password', { email: email });
      setInfo(data.message);
      setDevCode(data.devCode || '');
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiSend('POST', '/users/reset-password', { email: email, code: code, newPassword: newPassword });
      onDone(email, data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">ลืมรหัสผ่าน</h2>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        {step === 'email' ? 'กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัสยืนยัน 6 หลักให้' : 'กรอกรหัสยืนยันและตั้งรหัสผ่านใหม่'}
      </p>

      {step === 'email' && (
        <form onSubmit={requestCode} className="space-y-4">
          <Field label="อีเมล">
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'กำลังส่ง...' : 'ส่งรหัสยืนยัน'}</Button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={resetPassword} className="space-y-4">
          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{info}</p>
          {devCode && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              โหมดทดลอง (ยังไม่มีระบบส่งอีเมลจริง): รหัสของคุณคือ <span className="font-mono font-semibold tracking-widest">{devCode}</span>
            </p>
          )}
          <Field label="รหัสยืนยัน 6 หลัก">
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" className={inputClass + ' font-mono tracking-[0.4em] text-center'} />
          </Field>
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัวอักษร">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}</Button>
          <button type="button" onClick={() => setStep('email')} className="w-full text-sm text-slate-500 hover:underline">ส่งรหัสใหม่อีกครั้ง</button>
        </form>
      )}

      <button type="button" onClick={onBack} className="mt-6 text-sm text-indigo-600 hover:underline">← กลับไปหน้าเข้าสู่ระบบ</button>
    </div>
  );
}
