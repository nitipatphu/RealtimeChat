import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { SystemRoleBadge } from '../ui/Badge';
import { Field, ErrorBox, inputClass } from '../ui/Form';
import { formatDate, formatDateTime } from '../../utils/format';
import { showSuccess, askConfirm } from '../../utils/dialog';

export default function AccountTab({ currentUser, onLogout, showSaved }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (!oldPw || !newPw || !confirmPw) {
      setError('กรุณากรอกให้ครบทุกช่อง');
      return;
    }
    if (newPw.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPw !== confirmPw) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiSend('PUT', '/users/' + currentUser.id + '/password', { oldPassword: oldPw, newPassword: newPw });
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw) {
      setDeleteError('กรุณากรอกรหัสผ่านเพื่อยืนยัน');
      return;
    }
    const confirmed = await askConfirm('ลบบัญชีถาวร? ย้อนกลับไม่ได้');
    if (!confirmed) return;

    setDeleteError('');
    try {
      await apiSend('DELETE', '/users/' + currentUser.id, { password: deletePw });
      showSuccess('ลบบัญชีเรียบร้อยแล้ว');
      onLogout();
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="ข้อมูลบัญชี">
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-slate-500">อีเมล</dt>
            <dd className="text-slate-900 font-medium mt-0.5">{currentUser.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">สิทธิ์ในระบบ</dt>
            <dd className="mt-1"><SystemRoleBadge systemRole={currentUser.systemRole} /></dd>
          </div>
          <div>
            <dt className="text-slate-500">สมัครเมื่อ</dt>
            <dd className="text-slate-900 mt-0.5">{formatDate(currentUser.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">เข้าสู่ระบบล่าสุด</dt>
            <dd className="text-slate-900 mt-0.5">{formatDateTime(currentUser.lastLoginAt)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="เปลี่ยนรหัสผ่าน" description="แนะนำให้ใช้รหัสผ่านที่คาดเดายากและไม่ซ้ำกับที่อื่น">
        <form onSubmit={handleChangePw} className="space-y-4">
          <Field label="รหัสผ่านปัจจุบัน">
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={inputClass} autoComplete="current-password" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัวอักษร">
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputClass} autoComplete="new-password" />
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่">
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputClass} autoComplete="new-password" />
            </Field>
          </div>
          <ErrorBox message={error} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'อัปเดตรหัสผ่าน'}</Button>
          </div>
        </form>
      </Card>

      <Card title="ออกจากระบบ" description="ออกจากระบบบนอุปกรณ์นี้" action={<Button variant="secondary" icon="logout" onClick={onLogout}>ออกจากระบบ</Button>}>
        <span />
      </Card>

      <Card title="ลบบัญชี" description="บัญชีและการเป็นสมาชิกทุกกลุ่มจะถูกลบถาวร ถ้าคุณเป็นเจ้าของกลุ่ม ต้องโอนหรือลบกลุ่มก่อน" className="border-red-200">
        <div className="flex gap-2">
          <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} placeholder="กรอกรหัสผ่านเพื่อยืนยัน" className={inputClass} />
          <Button variant="danger" icon="trash" onClick={handleDeleteAccount}>ลบบัญชี</Button>
        </div>
        <div className="mt-3">
          <ErrorBox message={deleteError} />
        </div>
      </Card>
    </div>
  );
}
