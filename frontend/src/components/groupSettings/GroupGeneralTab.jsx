import { useState, useRef } from 'react';
import { apiSend, apiUpload } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { GroupAvatar } from '../ui/Avatar';
import { Field, ErrorBox, inputClass, textareaClass } from '../ui/Form';
import { VisibilityPicker } from '../lobby/CreateGroupModal';
import { hasPermission, ROLE_COLORS } from '../../utils/permissions';
import { copyText } from '../../utils/clipboard';
import { askConfirm } from '../../utils/dialog';

function iconButtonLabel(uploading, hasIcon) {
  if (uploading) return 'กำลังอัปโหลด...';
  if (hasIcon) return 'เปลี่ยนรูป';
  return 'อัปโหลดรูป';
}

export default function GroupGeneralTab({ group, currentUser, showSaved }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [visibility, setVisibility] = useState(group.visibility);
  const [color, setColor] = useState(group.color);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleIconChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('รองรับเฉพาะไฟล์ JPG, PNG, WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกิน 2 MB');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    setError('');
    try {
      await apiUpload('/groups/' + group.id + '/icon', formData);
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveIcon = async () => {
    const confirmed = await askConfirm('ลบรูปไอคอนกลุ่มและกลับไปใช้ตัวอักษร?');
    if (!confirmed) return;
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/icon');
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const canEdit = hasPermission(group, currentUser.id, 'manage_group');
  const isDirty = name !== group.name || description !== (group.description || '') || visibility !== group.visibility || color !== group.color;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiSend('PUT', '/groups/' + group.id + '/settings', {
        name: name,
        description: description,
        visibility: visibility,
        color: color
      });
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(group.name);
    setDescription(group.description || '');
    setVisibility(group.visibility);
    setColor(group.color);
    setError('');
  };

  const copyCode = () => {
    copyText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const newCode = async () => {
    const confirmed = await askConfirm('สร้างรหัสเชิญใหม่? รหัสเดิมจะใช้ไม่ได้อีก');
    if (!confirmed) return;
    try {
      await apiSend('POST', '/groups/' + group.id + '/invite-code', {});
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <Card title="ข้อมูลกลุ่ม" description={canEdit ? 'ชื่อและรายละเอียดที่สมาชิกจะเห็น' : 'คุณไม่มีสิทธิ์แก้ไขข้อมูลกลุ่ม'}>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <GroupAvatar group={{ name: name || 'G', color: color, icon: group.icon }} size="lg" />
          {canEdit && (
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleIconChange} className="hidden" />
              <Button size="sm" variant="secondary" icon="photo" onClick={() => fileRef.current.click()} disabled={uploading}>
                {iconButtonLabel(uploading, group.icon)}
              </Button>
              {group.icon && <Button size="sm" variant="ghost" onClick={handleRemoveIcon}>ลบรูป</Button>}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {ROLE_COLORS.map(item => (
              <button
                key={item}
                type="button"
                disabled={!canEdit}
                onClick={() => setColor(item)}
                title="เลือกสีกลุ่ม"
                className={`w-7 h-7 rounded-full transition-transform disabled:opacity-50 ${color === item ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                style={{ backgroundColor: item }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Field label="ชื่อกลุ่ม">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} disabled={!canEdit} className={inputClass} />
          </Field>
          <Field label="คำอธิบาย" hint={description.length + '/200'}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={3} disabled={!canEdit} className={textareaClass} placeholder="กลุ่มนี้ใช้ทำอะไร" />
          </Field>
          <Field label="การมองเห็น">
            <VisibilityPicker value={visibility} onChange={setVisibility} disabled={!canEdit} />
          </Field>
        </div>
      </Card>

      <Card title="รหัสเชิญ" description="ส่งรหัสนี้ให้เพื่อนเพื่อเข้าร่วมกลุ่ม ใช้ได้ทั้งกลุ่ม Public และ Private">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-mono text-xl font-semibold tracking-[0.3em] text-slate-900">
            {group.inviteCode}
          </div>
          <Button variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copyCode} size="lg">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button>
          {canEdit && <Button variant="secondary" icon="refresh" onClick={newCode} size="lg">สร้างใหม่</Button>}
        </div>
      </Card>

      <ErrorBox message={error} />

      {canEdit && isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-slate-900 text-white rounded-2xl shadow-2xl pl-5 pr-2 py-2">
          <span className="text-sm">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</span>
          <button type="button" onClick={handleReset} className="text-sm text-slate-300 hover:text-white px-2">ยกเลิก</button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </div>
      )}
    </div>
  );
}
