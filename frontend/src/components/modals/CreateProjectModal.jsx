import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass } from '../ui/Form';
import { getMemberIds, getDisplayName } from '../../utils/permissions';

export default function CreateProjectModal({ group, currentUser, users, onClose, onCreate }) {
  const [projectName, setProjectName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([currentUser.id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const memberIds = getMemberIds(group);
  const groupMembers = (users || []).filter(u => memberIds.includes(u.id));
  const query = search.trim().toLowerCase();
  let shownMembers = groupMembers;
  if (query) {
    shownMembers = groupMembers.filter(u => getDisplayName(group, u).toLowerCase().includes(query) || u.name.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
  }
  let allShownSelected = shownMembers.length > 0;
  shownMembers.forEach(u => {
    if (!selectedMembers.includes(u.id)) allShownSelected = false;
  });
  let selectAllLabel = 'เลือกทุกคน';
  if (query) selectAllLabel = 'เลือกทุกคนที่ค้นเจอ';
  if (allShownSelected) selectAllLabel = 'ยกเลิกที่เลือก';

  const toggleAllShown = () => {
    const shownIds = shownMembers.map(u => u.id);
    if (allShownSelected) {
      setSelectedMembers(selectedMembers.filter(id => id === currentUser.id || !shownIds.includes(id)));
    } else {
      const next = [...selectedMembers];
      shownIds.forEach(id => {
        if (!next.includes(id)) next.push(id);
      });
      setSelectedMembers(next);
    }
  };

  const toggleMember = (userId) => {
    if (userId === currentUser.id) return;
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleSubmit = async () => {
    if (!projectName.trim()) {
      setError('กรุณาตั้งชื่อ Project');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const newProject = await apiSend('POST', '/groups/' + group.id + '/projects', {
        projectName: projectName,
        members: selectedMembers
      });
      onCreate(newProject);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="สร้าง Project ใหม่"
      description="Project มีห้องแชทและบอร์ดงานของตัวเอง เห็นเฉพาะสมาชิกที่เลือก"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'กำลังสร้าง...' : 'สร้าง Project'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อ Project">
          <input autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น เว็บไซต์ร้านกาแฟ" className={inputClass} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-slate-700">สมาชิก ({selectedMembers.length}/{groupMembers.length})</span>
            <button type="button" onClick={toggleAllShown} className="text-xs font-medium text-indigo-600 hover:underline">
              {selectAllLabel}
            </button>
          </div>
          <div className="relative mb-2">
            <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass + ' pl-9'} placeholder="ค้นหาชื่อหรืออีเมล" />
          </div>
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {shownMembers.map(user => {
              const isSelected = selectedMembers.includes(user.id);
              const isMe = user.id === currentUser.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleMember(user.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                >
                  <input type="checkbox" checked={isSelected} readOnly disabled={isMe} className="w-4 h-4 accent-indigo-600" />
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-800 truncate">
                      {getDisplayName(group, user)} {isMe && <span className="text-xs text-slate-400">(คุณ)</span>}
                    </span>
                    {user.email && <span className="block text-xs text-slate-500 truncate">{user.email}</span>}
                  </span>
                </button>
              );
            })}
            {shownMembers.length === 0 && <p className="text-sm text-slate-400 text-center py-6">ไม่พบสมาชิก</p>}
          </div>
        </div>

        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
