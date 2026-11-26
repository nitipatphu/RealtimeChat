import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { ErrorBox, inputClass } from '../ui/Form';
import { getMemberIds, getDisplayName } from '../../utils/permissions';

export default function ProjectMembersModal({ group, project, users, onClose, onUpdateProject }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const projectMemberIds = project.members || [];
  const members = (users || []).filter(u => projectMemberIds.includes(u.id));
  let nonMembers = (users || []).filter(u => getMemberIds(group).includes(u.id) && !projectMemberIds.includes(u.id));
  const query = search.trim().toLowerCase();
  if (query) {
    nonMembers = nonMembers.filter(u => getDisplayName(group, u).toLowerCase().includes(query) || u.name.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
  }
  const baseUrl = '/groups/' + group.id + '/projects/' + project.id + '/members';

  const handleAdd = async (memberId) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiSend('POST', baseUrl, { memberId: memberId });
      onUpdateProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm('ยืนยันการนำสมาชิกออกจาก Project?')) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiSend('DELETE', baseUrl + '/' + memberId);
      onUpdateProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRow = (user, isMember) => (
    <div key={user.id} className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={user.avatar} name={user.name} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{getDisplayName(group, user)}</p>
          <p className="text-xs text-slate-500 truncate">{user.title || user.email}</p>
        </div>
      </div>
      {isMember ? (
        <Button size="sm" variant="dangerSoft" onClick={() => handleRemove(user.id)} disabled={loading}>นำออก</Button>
      ) : (
        <Button size="sm" variant="soft" icon="plus" onClick={() => handleAdd(user.id)} disabled={loading}>เพิ่ม</Button>
      )}
    </div>
  );

  return (
    <Modal title="สมาชิก Project" description="เฉพาะคนในรายชื่อนี้ (และผู้มีสิทธิ์จัดการ Project) ที่เห็นแชทและบอร์ด" onClose={onClose}>
      <ErrorBox message={error} />
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">อยู่ใน Project ({members.length})</p>
      <div className="divide-y divide-slate-100">{members.map(user => renderRow(user, true))}</div>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-5 mb-2">เพิ่มสมาชิกกลุ่มคนอื่น</p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} placeholder="ค้นหาชื่อหรืออีเมล..." />
      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">{nonMembers.map(user => renderRow(user, false))}</div>
      {nonMembers.length === 0 && <p className="text-sm text-slate-400 py-3">{query ? 'ไม่พบสมาชิก' : 'สมาชิกกลุ่มทุกคนอยู่ใน Project แล้ว'}</p>}
    </Modal>
  );
}
