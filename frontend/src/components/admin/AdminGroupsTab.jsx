import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Avatar, { GroupAvatar } from '../ui/Avatar';
import { VisibilityBadge } from '../ui/Badge';
import Modal from '../ui/Modal';
import LogList from '../ui/LogList';
import { Field, ErrorBox, inputClass, inputBaseClass, textareaClass } from '../ui/Form';
import { VisibilityPicker } from '../lobby/CreateGroupModal';
import { isAdminUser } from '../../utils/permissions';
import { formatDate } from '../../utils/format';
import UserPicker from '../ui/UserPicker';

function GroupFormModal({ group, currentUser, onClose, onSaved }) {
  const [name, setName] = useState(group ? group.name : '');
  const [description, setDescription] = useState(group ? group.description : '');
  const [visibility, setVisibility] = useState(group ? group.visibility : 'private');
  const [ownerId, setOwnerId] = useState(group ? group.ownerId : currentUser.id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ownerId) {
      setError('กรุณาเลือกเจ้าของกลุ่ม');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { name: name, description: description, visibility: visibility, ownerId: ownerId };
      if (group) {
        await apiSend('PUT', '/admin/groups/' + group.id, body);
      } else {
        await apiSend('POST', '/admin/groups', body);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={group ? 'แก้ไขกลุ่ม' : 'สร้างกลุ่ม'}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อกลุ่ม">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={50} autoFocus />
        </Field>
        <Field label="คำอธิบาย">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} className={textareaClass} />
        </Field>
        <div>
          <UserPicker
            label="เจ้าของกลุ่ม"
            value={ownerId}
            onChange={setOwnerId}
            initialUser={group ? { id: group.ownerId, name: group.ownerName, email: group.ownerEmail, avatar: group.ownerAvatar } : currentUser}
          />
          {group && <span className="block text-xs text-slate-400 mt-1.5">ถ้าเจ้าของใหม่ยังไม่อยู่ในกลุ่ม ระบบจะเพิ่มเข้ากลุ่มให้</span>}
        </div>
        <Field label="การมองเห็น">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

function GroupDetailModal({ groupId, currentUser, onClose, onInspect }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/admin/groups/' + groupId)
      .then(setDetail)
      .catch(err => setError(err.message));
  }, [groupId, currentUser.id]);

  return (
    <Modal
      title={detail ? detail.name : 'รายละเอียดกลุ่ม'}
      description={detail ? detail.description : ''}
      onClose={onClose}
      width="max-w-2xl"
      footer={onInspect && <Button icon="eye" onClick={() => onInspect(groupId)}>เข้าไปดูทุกอย่างในกลุ่ม</Button>}
    >
      <ErrorBox message={error} />
      {!detail && !error && <p className="text-sm text-slate-500">กำลังโหลด...</p>}
      {detail && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><dt className="text-slate-500">เจ้าของ</dt><dd className="font-medium text-slate-900">{detail.ownerName}</dd></div>
            <div><dt className="text-slate-500">รหัสเชิญ</dt><dd className="font-mono font-medium text-slate-900">{detail.inviteCode}</dd></div>
            <div><dt className="text-slate-500">Channel</dt><dd className="font-medium text-slate-900">{detail.channelCount}</dd></div>
            <div><dt className="text-slate-500">Project</dt><dd className="font-medium text-slate-900">{detail.projectCount}</dd></div>
          </dl>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">สมาชิก ({detail.members.length})</p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {detail.members.map(member => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar src={member.avatar} name={member.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">{member.nickname || member.name}</p>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.roleColor }} />
                    {member.roleName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Log ล่าสุดของกลุ่ม</p>
            <LogList logs={detail.logs} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminGroupsTab({ currentUser, showSaved, onInspectGroup }) {
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = isAdminUser(currentUser);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/admin/groups')
      .then(data => setGroups(data))
      .catch(err => setError(err.message));
  }, [currentUser.id, reloadKey]);

  const load = () => {
    setReloadKey(key => key + 1);
  };

  const deleteGroup = async (group) => {
    const typed = window.prompt('พิมพ์ชื่อกลุ่ม "' + group.name + '" เพื่อยืนยันการลบ');
    if (typed === null) return;
    if (typed !== group.name) {
      setError('ชื่อกลุ่มไม่ตรง ยกเลิกการลบ');
      return;
    }
    setError('');
    try {
      await apiSend('DELETE', '/admin/groups/' + group.id);
      showSaved();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  let list = groups;
  if (search.trim()) {
    const query = search.trim().toLowerCase();
    list = list.filter(g => g.name.toLowerCase().includes(query) || g.ownerName.toLowerCase().includes(query));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อกลุ่มหรือเจ้าของ..." className={inputBaseClass + ' w-72 h-10'} />
        <div className="flex-1" />
        {isAdmin && <Button icon="plus" onClick={() => setEditing('new')}>สร้างกลุ่ม</Button>}
      </div>

      <ErrorBox message={error} />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="font-medium px-5 py-3">กลุ่ม</th>
                <th className="font-medium px-3 py-3">การมองเห็น</th>
                <th className="font-medium px-3 py-3">เจ้าของ</th>
                <th className="font-medium px-3 py-3 text-right">สมาชิก</th>
                <th className="font-medium px-3 py-3 text-right">ข้อความ</th>
                <th className="font-medium px-3 py-3">สร้างเมื่อ</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(group => (
                <tr key={group.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setViewingId(group.id)} className="flex items-center gap-3 text-left">
                      <GroupAvatar group={group} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate hover:underline">{group.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-xs">{group.description || '-'}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3"><VisibilityBadge visibility={group.visibility} /></td>
                  <td className="px-3 py-3 text-slate-700">{group.ownerName}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{group.memberCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{group.messageCount}</td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(group.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton icon="list" title="ดูรายละเอียด" size="sm" onClick={() => setViewingId(group.id)} />
                      {onInspectGroup && <IconButton icon="eye" title="เข้าดูกลุ่ม (โหมดตรวจสอบ)" size="sm" onClick={() => onInspectGroup(group.id)} />}
                      {isAdmin && <IconButton icon="pencil" title="แก้ไข" size="sm" onClick={() => setEditing(group)} />}
                      {isAdmin && <IconButton icon="trash" title="ลบกลุ่ม" size="sm" danger onClick={() => deleteGroup(group)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-center text-sm text-slate-400 py-10">ไม่พบกลุ่ม</p>}
        </div>
      </Card>

      {editing && (
        <GroupFormModal
          group={editing === 'new' ? null : editing}
          currentUser={currentUser}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showSaved();
            load();
          }}
        />
      )}

      {viewingId && <GroupDetailModal groupId={viewingId} currentUser={currentUser} onClose={() => setViewingId(null)} onInspect={onInspectGroup} />}
    </div>
  );
}
