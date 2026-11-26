import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ErrorBox } from '../ui/Form';
import UserPicker from '../ui/UserPicker';
import { getMemberIds } from '../../utils/permissions';

function DangerRow({ title, text, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{text}</p>
      </div>
      <div className="flex gap-2 shrink-0">{children}</div>
    </div>
  );
}

export default function GroupDangerTab({ group, currentUser, users, onLeft, showSaved }) {
  const [newOwnerId, setNewOwnerId] = useState('');
  const [error, setError] = useState('');

  const isOwner = group.ownerId === currentUser.id;
  const others = (users || []).filter(u => getMemberIds(group).includes(u.id) && u.id !== currentUser.id);

  const handleLeave = async () => {
    if (!window.confirm('ออกจากกลุ่ม ' + group.name + '?')) return;
    try {
      await apiSend('POST', '/groups/' + group.id + '/leave', {});
      onLeft();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTransfer = async () => {
    const newOwner = others.find(u => u.id === newOwnerId);
    if (!newOwner) return;
    if (!window.confirm('โอนความเป็นเจ้าของให้ ' + newOwner.name + '? คุณจะได้ Role ที่สูงที่สุดรองลงมาแทน')) return;
    try {
      await apiSend('POST', '/groups/' + group.id + '/transfer', { newOwnerId: newOwnerId });
      setNewOwnerId('');
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    const typed = window.prompt('พิมพ์ชื่อกลุ่ม "' + group.name + '" เพื่อยืนยันการลบ');
    if (typed === null) return;
    if (typed !== group.name) {
      setError('ชื่อกลุ่มไม่ตรง ยกเลิกการลบ');
      return;
    }
    try {
      await apiSend('DELETE', '/groups/' + group.id, {});
      onLeft();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card title="โซนอันตราย" description="การกระทำเหล่านี้มีผลทันที บางอย่างย้อนกลับไม่ได้" className="border-red-200">
      <div className="divide-y divide-slate-100">
        {!isOwner && (
          <DangerRow title="ออกจากกลุ่ม" text="คุณจะไม่เห็นแชทและงานในกลุ่มนี้อีก จนกว่าจะเข้าร่วมใหม่">
            <Button variant="dangerSoft" icon="logout" onClick={handleLeave}>ออกจากกลุ่ม</Button>
          </DangerRow>
        )}

        {isOwner && (
          <>
            <DangerRow title="โอนความเป็นเจ้าของ" text="เจ้าของใหม่จะมีสิทธิ์ทุกอย่าง">
              <div className="w-72">
                <UserPicker users={others} value={newOwnerId} onChange={setNewOwnerId} placeholder="ค้นหาสมาชิก..." />
              </div>
              <Button variant="dangerSoft" onClick={handleTransfer} disabled={!newOwnerId}>โอน</Button>
            </DangerRow>
            <DangerRow title="ลบกลุ่ม" text="แชท โปรเจกต์ บอร์ดงาน และ Log ทั้งหมดจะถูกลบถาวร">
              <Button variant="danger" icon="trash" onClick={handleDelete}>ลบกลุ่ม</Button>
            </DangerRow>
          </>
        )}
      </div>
      <div className="mt-4">
        <ErrorBox message={error} />
      </div>
    </Card>
  );
}
