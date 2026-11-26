import { useState, useEffect } from 'react';
import socket from '../../socket';
import { apiGet, apiSend } from '../../api';
import DirectMessageView from '../workspace/DirectMessageView';
import GroupChatView from './GroupChatView';
import NewChatModal from './NewChatModal';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import Button, { IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Card';
import { getPresence, PRESENCE } from '../../utils/presence';
import { timeAgo } from '../../utils/format';

function StackedAvatars({ ids, users }) {
  const people = ids.map(id => (users || []).find(u => u.id === id)).filter(u => u).slice(0, 2);
  return (
    <span className="relative w-10 h-10 shrink-0">
      {people.map((user, index) => (
        <span key={user.id} className={`absolute rounded-full ring-2 ring-white ${index === 0 ? 'top-0 left-0' : 'bottom-0 right-0'}`}>
          <Avatar src={user.avatar} name={user.name} size="sm" />
        </span>
      ))}
    </span>
  );
}

export default function MessagesView({
  currentUser,
  users,
  onlineUserIds,
  target,
  onSelectTarget,
  unread,
  mutedRooms,
  onToggleMute,
  onOpenProfile
}) {
  const [conversations, setConversations] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    apiGet('/conversations')
      .then(data => setConversations(data))
      .catch(err => console.error(err));
  }, [currentUser.id, reloadKey]);

  useEffect(() => {
    const reload = () => setReloadKey(key => key + 1);
    const handleRemoved = (data) => {
      reload();
      if (target && target.type === 'gdm' && target.id === data.conversationId) {
        onSelectTarget(null);
      }
    };

    socket.on('gdm:changed', reload);
    socket.on('gdm:new', reload);
    socket.on('dm:new', reload);
    socket.on('gdm:removed', handleRemoved);
    return () => {
      socket.off('gdm:changed', reload);
      socket.off('gdm:new', reload);
      socket.off('dm:new', reload);
      socket.off('gdm:removed', handleRemoved);
    };
  }, [target, onSelectTarget]);

  const nameOf = (id) => {
    const user = (users || []).find(u => u.id === id);
    return user ? user.name : 'ผู้ใช้';
  };

  const chatTitle = (chat) => {
    if (chat.name) return chat.name;
    return chat.participants.filter(id => id !== currentUser.id).map(nameOf).join(', ');
  };

  const startChat = async (selectedIds, name) => {
    if (selectedIds.length === 1) {
      setModal(null);
      onSelectTarget({ type: 'dm', id: selectedIds[0] });
      return;
    }
    const chat = await apiSend('POST', '/conversations', { memberIds: selectedIds, name: name });
    setModal(null);
    setReloadKey(key => key + 1);
    onSelectTarget({ type: 'gdm', id: chat.id });
  };

  const activeChat = target && target.type === 'gdm' ? conversations.find(c => c.type === 'gdm' && c.id === target.id) : null;
  const activeUser = target && target.type === 'dm' ? (users || []).find(u => u.id === target.id) : null;

  const addMembers = async (selectedIds) => {
    await apiSend('POST', '/conversations/' + activeChat.id + '/members', { memberIds: selectedIds });
    setModal(null);
    setReloadKey(key => key + 1);
  };

  const renameChat = async () => {
    const newName = window.prompt('ตั้งชื่อแชทกลุ่ม', activeChat.name || '');
    if (newName === null) return;
    try {
      await apiSend('PUT', '/conversations/' + activeChat.id, { name: newName });
      setReloadKey(key => key + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const leaveChat = async () => {
    if (!window.confirm('ออกจากแชทกลุ่มนี้?')) return;
    try {
      await apiSend('POST', '/conversations/' + activeChat.id + '/leave', {});
      onSelectTarget(null);
      setReloadKey(key => key + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const showList = !target;
  const muteKey = target ? target.type + ':' + target.id : '';
  const muted = (mutedRooms || []).includes(muteKey);

  let header = null;
  let body = (
    <div className="flex-1 flex items-center justify-center">
      <EmptyState icon="chat" title="เลือกแชททางด้านซ้าย" text="หรือกด 'แชทใหม่' เพื่อเริ่มคุยกับใครก็ได้ในระบบ" />
    </div>
  );

  if (activeUser) {
    const status = getPresence(activeUser, onlineUserIds);
    header = (
      <>
        <Avatar src={activeUser.avatar} name={activeUser.name} size="md" status={status} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900 truncate">{activeUser.name}</p>
          <p className="text-xs text-slate-500">{PRESENCE[status].label}</p>
        </div>
      </>
    );
    body = <DirectMessageView key={activeUser.id} otherUser={activeUser} currentUser={currentUser} users={users} onOpenProfile={onOpenProfile} />;
  }

  if (activeChat) {
    header = (
      <>
        <StackedAvatars ids={activeChat.participants.filter(id => id !== currentUser.id)} users={users} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900 truncate">{chatTitle(activeChat)}</p>
          <p className="text-xs text-slate-500 truncate">{activeChat.participants.length} คน · {activeChat.participants.map(nameOf).join(', ')}</p>
        </div>
        <IconButton icon="pencil" title="เปลี่ยนชื่อแชท" onClick={renameChat} />
        <IconButton icon="plus" title="เพิ่มคน" onClick={() => setModal('add')} />
        <IconButton icon="logout" title="ออกจากแชทกลุ่ม" danger onClick={leaveChat} />
      </>
    );
    body = <GroupChatView key={activeChat.id} chat={activeChat} currentUser={currentUser} users={users} onOpenProfile={onOpenProfile} />;
  }

  if (target && !header) {
    header = <p className="flex-1 text-sm text-slate-500">กำลังโหลดแชท...</p>;
    body = <div className="flex-1 flex items-center justify-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  return (
    <div className="flex h-full min-w-0">
      <aside className={(showList ? 'flex' : 'hidden') + ' md:flex w-full md:w-80 shrink-0 flex-col bg-white border-r border-slate-200'}>
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-slate-200">
          <p className="text-base font-semibold text-slate-900">ข้อความ</p>
          <Button size="sm" icon="plus" onClick={() => setModal('new')}>แชทใหม่</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 && <EmptyState icon="chat" title="ยังไม่มีแชท" text="เริ่มคุยกับเพื่อนได้จากปุ่ม 'แชทใหม่'" />}
          {conversations.map(item => {
            const key = item.type + ':' + item.id;
            const isActive = target && target.type === item.type && target.id === item.id;
            const count = (mutedRooms || []).includes(key) ? 0 : unread[key];
            const isDm = item.type === 'dm';
            const user = isDm ? (users || []).find(u => u.id === item.id) : null;
            let title = chatTitle(item);
            if (isDm) title = user ? user.name : 'ผู้ใช้';
            let preview = 'ยังไม่มีข้อความ';
            if (item.lastMessage) {
              preview = item.lastMessage.text;
              if (item.lastMessage.authorId === currentUser.id) preview = 'คุณ: ' + preview;
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectTarget({ type: item.type, id: item.id })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                {isDm ? (
                  <Avatar src={user ? user.avatar : null} name={user ? user.name : '?'} size="md" status={getPresence(user, onlineUserIds)} />
                ) : (
                  <StackedAvatars ids={item.participants.filter(id => id !== currentUser.id)} users={users} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className={`text-sm truncate ${count ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                      {title}
                    </span>
                    {!isDm && <Icon name="users" className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    {(mutedRooms || []).includes(key) && <Icon name="bellSlash" className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {preview}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  {item.lastMessage && <span className="text-[11px] text-slate-400">{timeAgo(item.lastMessage.createdAt)}</span>}
                  {count > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">{count}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className={(showList ? 'hidden' : 'flex') + ' md:flex flex-1 flex-col min-w-0 bg-white'}>
        {header && (
          <header className="h-14 sm:h-16 shrink-0 border-b border-slate-200 px-2 sm:px-5 flex items-center gap-2 sm:gap-3">
            <IconButton icon="arrowLeft" title="กลับไปที่รายการ" onClick={() => onSelectTarget(null)} className="md:hidden" />
            {header}
            <IconButton icon={muted ? 'bellSlash' : 'bell'} title={muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'} active={muted} onClick={() => onToggleMute(muteKey)} />
          </header>
        )}
        {body}
      </main>

      {modal === 'new' && (
        <NewChatModal
          users={users}
          currentUser={currentUser}
          title="แชทใหม่"
          allowName
          confirmLabel={(count) => (count >= 2 ? 'สร้างแชทกลุ่ม (' + (count + 1) + ' คน)' : 'เริ่มแชท')}
          onClose={() => setModal(null)}
          onConfirm={startChat}
        />
      )}
      {modal === 'add' && activeChat && (
        <NewChatModal
          users={users}
          currentUser={currentUser}
          excludeIds={activeChat.participants}
          title="เพิ่มคนเข้าแชทกลุ่ม"
          confirmLabel={(count) => 'เพิ่ม ' + count + ' คน'}
          onClose={() => setModal(null)}
          onConfirm={addMembers}
        />
      )}
    </div>
  );
}
