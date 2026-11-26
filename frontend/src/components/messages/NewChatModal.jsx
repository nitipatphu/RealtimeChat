import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass } from '../ui/Form';

export default function NewChatModal({ users, currentUser, excludeIds, title, confirmLabel, allowName, onClose, onConfirm }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const hidden = [currentUser.id].concat(excludeIds || []);
  let list = (users || []).filter(u => !hidden.includes(u.id) && u.accountStatus !== 'suspended');
  if (search.trim()) {
    const query = search.trim().toLowerCase();
    list = list.filter(u => u.name.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
  }

  const toggle = (userId) => {
    if (selectedIds.includes(userId)) {
      setSelectedIds(selectedIds.filter(id => id !== userId));
    } else {
      setSelectedIds([...selectedIds, userId]);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 คน');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm(selectedIds, name);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  let hint = 'เลือก 1 คนเพื่อคุยส่วนตัว หรือ 2 คนขึ้นไปเพื่อสร้างแชทกลุ่ม';
  if (!allowName) hint = 'เลือกคนที่จะเพิ่มเข้าแชท';

  return (
    <Modal
      title={title}
      description={hint}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={saving}>{confirmLabel(selectedIds.length)}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {allowName && selectedIds.length >= 2 && (
          <Field label="ชื่อแชทกลุ่ม (ไม่บังคับ)">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={inputClass} placeholder="เช่น ทีมไปเที่ยว" />
          </Field>
        )}

        <div className="relative">
          <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass + ' pl-9'} placeholder="ค้นหาชื่อหรืออีเมล" />
        </div>

        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {list.map(user => {
            const selected = selectedIds.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggle(user.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
              >
                <input type="checkbox" checked={selected} readOnly className="w-4 h-4 accent-indigo-600" />
                <Avatar src={user.avatar} name={user.name} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800 truncate">{user.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p className="text-sm text-slate-400 text-center py-6">ไม่พบผู้ใช้</p>}
        </div>

        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
