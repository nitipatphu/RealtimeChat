import { useState } from 'react';
import { apiSend } from '../../api';
import Card from '../ui/Card';
import Button, { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import MemberRolesEditor from './MemberRolesEditor';
import ModerationActions from './ModerationActions';
import { formatDate } from '../../utils/format';
import { Field, ErrorBox, inputClass, inputBaseClass } from '../ui/Form';
import { hasPermission, getNickname, getMemberIds, getTimeoutUntil } from '../../utils/permissions';
import { getPresence } from '../../utils/presence';

function NicknameModal({ group, member, currentUser, onClose, showSaved }) {
  const [nickname, setNickname] = useState(getNickname(group, member.id));
  const [error, setError] = useState('');

  const save = async (value) => {
    try {
      await apiSend('PUT', '/groups/' + group.id + '/members/' + member.id + '/nickname', { nickname: value });
      showSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const isMe = member.id === currentUser.id;

  return (
    <Modal
      title={isMe ? 'เปลี่ยนชื่อเล่นของฉัน' : 'เปลี่ยนชื่อเล่นของ ' + member.name}
      description={'ชื่อเล่นจะแสดงเฉพาะในกลุ่ม ' + group.name}
      onClose={onClose}
      footer={
        <>
          {getNickname(group, member.id) && <Button variant="ghost" onClick={() => save('')}>ใช้ชื่อจริง</Button>}
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => save(nickname)}>บันทึก</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(nickname); }} className="space-y-3">
        <Field label="ชื่อเล่น" hint={'ชื่อจริง: ' + member.name + ' · ' + nickname.length + '/32'}>
          <input autoFocus value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={32} className={inputClass} placeholder={member.name} />
        </Field>
        <ErrorBox message={error} />
      </form>
    </Modal>
  );
}

export default function GroupMembersTab({ group, currentUser, users, onlineUserIds, showSaved }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [nicknameFor, setNicknameFor] = useState(null);

  const canManageMembers = hasPermission(group, currentUser.id, 'manage_members');
  const canBan = hasPermission(group, currentUser.id, 'ban_members');
  const bans = group.bans || [];

  const handleUnban = async (memberId) => {
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/bans/' + memberId);
    } catch (err) {
      alert(err.message);
    }
  };

  const canManageNicknames = hasPermission(group, currentUser.id, 'manage_nicknames');
  const canChangeOwnNickname = hasPermission(group, currentUser.id, 'change_nickname');

  const memberIds = getMemberIds(group);
  let members = (users || []).filter(u => memberIds.includes(u.id));
  members.sort((a, b) => {
    if (a.id === group.ownerId) return -1;
    if (b.id === group.ownerId) return 1;
    return a.name.localeCompare(b.name);
  });

  if (search.trim()) {
    const query = search.trim().toLowerCase();
    members = members.filter(m => m.name.toLowerCase().includes(query) || getNickname(group, m.id).toLowerCase().includes(query));
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    try {
      await apiSend('POST', '/groups/' + group.id + '/members', { email: email });
      setEmail('');
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };


  const handleKick = async (member) => {
    if (!window.confirm('นำ ' + member.name + ' ออกจากกลุ่ม?')) return;
    setError('');
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/members/' + member.id, {});
      showSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {canManageMembers && (
        <Card title="เพิ่มสมาชิก" description="เพิ่มด้วยอีเมลที่ใช้สมัคร หรือส่งรหัสเชิญให้เพื่อนเข้าเอง">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" className={inputClass} />
            <Button type="submit" icon="plus">เพิ่ม</Button>
          </form>
        </Card>
      )}

      <ErrorBox message={error} />

      <Card
        title={'สมาชิก (' + memberIds.length + ')'}
        action={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสมาชิก..." className={inputBaseClass + ' w-56 h-9'} />}
        padding="none"
      >
        <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
          {members.map(member => {
            const isOwner = member.id === group.ownerId;
            const isMe = member.id === currentUser.id;
            const nickname = getNickname(group, member.id);
            const status = getPresence(member, onlineUserIds);
            const canEditNickname = isMe ? canChangeOwnNickname : canManageNicknames && !isOwner;

            return (
              <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3.5">
                <Avatar src={member.avatar} name={member.name} size="md" status={status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {nickname || member.name}
                    {isMe && <span className="text-slate-400 font-normal"> (คุณ)</span>}
                    {getTimeoutUntil(group, member.id) && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        <Icon name="clock" className="w-3 h-3" />
                        Timeout
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{nickname ? member.name + ' · ' : ''}{member.email}</p>
                </div>

                <div className="w-full sm:w-auto sm:max-w-[45%]">
                  <MemberRolesEditor group={group} memberId={member.id} currentUser={currentUser} />
                </div>

                <div className="flex items-center gap-1 w-[72px] justify-end">
                  {canEditNickname && <IconButton icon="tag" title="เปลี่ยนชื่อเล่น" size="sm" onClick={() => setNicknameFor(member)} />}
                  {canManageMembers && !isOwner && !isMe && (
                    <IconButton icon="logout" title="นำออกจากกลุ่ม" size="sm" danger onClick={() => handleKick(member)} />
                  )}
                </div>

                <div className="w-full pl-14 empty:hidden">
                  <ModerationActions group={group} memberId={member.id} memberName={nickname || member.name} currentUser={currentUser} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {canBan && (
        <Card
          title={'ถูกแบน (' + bans.length + ')'}
          description="คนที่ถูกแบนกลับเข้ากลุ่มไม่ได้ ทั้งด้วยรหัสเชิญและการกดเข้าร่วมเอง"
          padding="none"
        >
          {bans.length === 0 ? (
            <p className="px-6 pb-5 text-sm text-slate-400">ยังไม่มีใครถูกแบน</p>
          ) : (
            <div className="divide-y divide-slate-100 mt-4 border-t border-slate-100">
              {bans.map(ban => {
                const bannedUser = (users || []).find(u => u.id === ban.userId);
                const byUser = (users || []).find(u => u.id === ban.byId);
                return (
                  <div key={ban.userId} className="flex items-center gap-3 px-4 sm:px-6 py-3.5">
                    <Avatar src={bannedUser ? bannedUser.avatar : null} name={bannedUser ? bannedUser.name : '?'} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{bannedUser ? bannedUser.name : 'ผู้ใช้ที่ถูกลบ'}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {ban.reason ? 'เหตุผล: ' + ban.reason + ' · ' : ''}แบนโดย {byUser ? byUser.name : '-'} · {formatDate(ban.createdAt)}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleUnban(ban.userId)}>ปลดแบน</Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {nicknameFor && (
        <NicknameModal group={group} member={nicknameFor} currentUser={currentUser} showSaved={showSaved} onClose={() => setNicknameFor(null)} />
      )}
    </div>
  );
}
