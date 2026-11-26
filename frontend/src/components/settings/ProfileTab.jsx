import { useState, useRef } from 'react';
import { apiSend, apiUpload } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Avatar, { StatusDot } from '../ui/Avatar';
import { PRESENCE, PRESENCE_ORDER } from '../../utils/presence';
import { SystemRoleBadge } from '../ui/Badge';
import { Field, ErrorBox, inputClass, textareaClass } from '../ui/Form';
import { ROLE_COLORS } from '../../utils/permissions';

function ProfilePreview({ user, name, title, bio, bannerColor }) {
  const presence = user.presence || 'online';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="h-20" style={{ backgroundColor: bannerColor }} />
      <div className="px-5 pb-5">
        <div className="-mt-10 mb-3">
          <span className="inline-block rounded-full ring-4 ring-white">
            <Avatar src={user.avatar} name={name} size="xl" status={presence} />
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-lg font-semibold text-slate-900">{name || 'ชื่อของคุณ'}</p>
          {user.systemRole !== 'member' && <SystemRoleBadge systemRole={user.systemRole} />}
        </div>
        {title && <p className="text-sm text-slate-600">{title}</p>}
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <StatusDot status={presence} className="w-2.5 h-2.5" />
          {PRESENCE[presence].label}
        </p>
        {bio && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">เกี่ยวกับ</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfileTab({ currentUser, onUserUpdated, showSaved }) {
  const [name, setName] = useState(currentUser.name || '');
  const [title, setTitle] = useState(currentUser.title || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [bannerColor, setBannerColor] = useState(currentUser.bannerColor || ROLE_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const isUploadedAvatar = currentUser.avatar && currentUser.avatar.includes('/uploads/');
  const isDirty =
    name !== (currentUser.name || '') ||
    title !== (currentUser.title || '') ||
    bio !== (currentUser.bio || '') ||
    bannerColor !== (currentUser.bannerColor || ROLE_COLORS[0]);

  const handleFileChange = async (e) => {
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

    setError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const data = await apiUpload('/users/' + currentUser.id + '/avatar', formData);
      onUserUpdated(data.user);
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('ลบรูปโปรไฟล์และใช้รูปตัวอักษรแทน?')) return;
    try {
      const data = await apiSend('DELETE', '/users/' + currentUser.id + '/avatar');
      onUserUpdated(data.user);
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePresence = async (presence) => {
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id + '/presence', { presence: presence });
      onUserUpdated(data.user);
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อ');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id, { name: name, title: title, bio: bio, bannerColor: bannerColor });
      onUserUpdated(data.user);
      showSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(currentUser.name || '');
    setTitle(currentUser.title || '');
    setBio(currentUser.bio || '');
    setBannerColor(currentUser.bannerColor || ROLE_COLORS[0]);
    setError('');
  };

  return (
    <div className="grid xl:grid-cols-[1fr_320px] gap-6 items-start pb-24">
      <div className="space-y-6">
        <Card title="สถานะ" description="คนอื่นจะเห็นจุดสีที่รูปโปรไฟล์ของคุณ เปลี่ยนได้จากรูปโปรไฟล์มุมซ้ายล่างด้วย">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESENCE_ORDER.map(key => {
              const selected = (currentUser.presence || 'online') === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresence(key)}
                  className={`flex items-center gap-2 px-3 h-11 rounded-xl border-2 text-sm font-medium transition-colors ${
                    selected ? 'border-indigo-500 bg-indigo-50/60 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <StatusDot status={key} className="w-3 h-3" />
                  {PRESENCE[key].label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="รูปโปรไฟล์และสีแบนเนอร์">
          <div className="flex items-center gap-5">
            <Avatar src={currentUser.avatar} name={name} size="xl" />
            <div className="space-y-2">
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                <Button size="sm" icon="paperclip" onClick={() => fileRef.current.click()} disabled={uploading}>
                  {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปใหม่'}
                </Button>
                {isUploadedAvatar && <Button size="sm" variant="secondary" onClick={handleRemoveAvatar}>ลบรูป</Button>}
              </div>
              <p className="text-xs text-slate-500">JPG, PNG หรือ WEBP ไม่เกิน 2 MB</p>
            </div>
          </div>
          <div className="mt-5">
            <span className="block text-sm font-medium text-slate-700 mb-2">สีแบนเนอร์</span>
            <div className="flex gap-2">
              {ROLE_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBannerColor(color)}
                  className={`w-8 h-8 rounded-lg ${bannerColor === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card title="ข้อมูลส่วนตัว" description="คนอื่นจะเห็นข้อมูลนี้เมื่อกดดูโปรไฟล์ของคุณ">
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="ชื่อที่แสดง">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={inputClass} />
              </Field>
              <Field label="ตำแหน่ง / บทบาท">
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} className={inputClass} placeholder="เช่น Frontend Developer" />
              </Field>
            </div>
            <Field label="เกี่ยวกับฉัน" hint={bio.length + '/200'}>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} className={textareaClass} placeholder="แนะนำตัวสั้น ๆ" />
            </Field>
          </div>
        </Card>

        <ErrorBox message={error} />
      </div>

      <div className="xl:sticky xl:top-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ตัวอย่างที่คนอื่นเห็น</p>
        <ProfilePreview user={currentUser} name={name} title={title} bio={bio} bannerColor={bannerColor} />
      </div>

      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-slate-900 text-white rounded-2xl shadow-2xl pl-5 pr-2 py-2">
          <span className="text-sm">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</span>
          <button type="button" onClick={handleReset} className="text-sm text-slate-300 hover:text-white px-2">ยกเลิก</button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </div>
      )}
    </div>
  );
}
