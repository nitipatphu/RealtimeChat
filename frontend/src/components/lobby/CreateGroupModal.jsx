import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass, textareaClass } from '../ui/Form';

export function VisibilityPicker({ value, onChange, disabled }) {
  const options = [
    { value: 'private', icon: 'lock', title: 'Private', text: 'เข้าได้ด้วยรหัสเชิญเท่านั้น' },
    { value: 'public', icon: 'globe', title: 'Public', text: 'ใครก็ค้นหาและกดเข้าร่วมได้' }
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`text-left p-3.5 rounded-xl border-2 transition-colors disabled:opacity-60 ${
              selected ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name={option.icon} className={`w-5 h-5 ${selected ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="text-sm font-semibold text-slate-900">{option.title}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{option.text}</p>
          </button>
        );
      })}
    </div>
  );
}

export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('กรุณาตั้งชื่อกลุ่ม');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const group = await apiSend('POST', '/groups', {
        name: name,
        description: description,
        visibility: visibility
      });
      onCreated(group);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="สร้างกลุ่มใหม่"
      description="กลุ่มคือพื้นที่สำหรับทีมของคุณ มีแชท โปรเจกต์ และบอร์ดงาน"
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'กำลังสร้าง...' : 'สร้างกลุ่ม'}</Button>
        </>
      }
    >
      <form onSubmit={handleCreate} className="space-y-4">
        <Field label="ชื่อกลุ่ม">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={inputClass} placeholder="เช่น ทีมพัฒนาเว็บ" />
        </Field>
        <Field label="คำอธิบาย" hint={description.length + '/200'}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} className={textareaClass} placeholder="กลุ่มนี้ใช้ทำอะไร" />
        </Field>
        <Field label="ใครเข้าร่วมได้บ้าง">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </Field>
        <ErrorBox message={error} />
      </form>
    </Modal>
  );
}
