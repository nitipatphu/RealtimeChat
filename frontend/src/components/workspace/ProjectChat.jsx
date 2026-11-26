import { useState, useEffect } from 'react';
import useChatScroll from '../../hooks/useChatScroll';
import useJumpToMessage from '../../hooks/useJumpToMessage';
import socket from '../../socket';
import { apiGet, apiSend } from '../../api';
import MessageList from '../chat/MessageList';
import ChatInput from '../chat/ChatInput';
import ThreadPanel from '../chat/ThreadPanel';
import TypingIndicator from '../chat/TypingIndicator';
import PinnedPanel from '../chat/PinnedPanel';
import LoadOlderButton from '../chat/LoadOlderButton';
import { mergeMessages, getOldestTime, getLastId } from '../../utils/messages';
import Icon from '../ui/Icon';
import { IconButton } from '../ui/Button';
import { getMemberIds, canSeeProject, getDisplayName, hasPermission, getTimeoutUntil } from '../../utils/permissions';

function changeList(setMessageData, change) {
  setMessageData(prev => ({ channelId: prev.channelId, list: change(prev.list), hasMore: prev.hasMore }));
}

export default function ProjectChat({ project, group, initialChannelId, currentUser, users, onOpenProfile, readOnly, showPins, onClosePins, focusMessageId }) {
  const [channels, setChannels] = useState([]);
  const [activeProjChannelId, setActiveProjChannelId] = useState(initialChannelId || null);
  const [messageData, setMessageData] = useState({ channelId: null, list: [], hasMore: false });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pinsKey, setPinsKey] = useState(0);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = currentUser.id;
  const groupId = group.id;
  const projectId = project.id;
  const projectUrl = '/groups/' + groupId + '/projects/' + projectId;

  let activeChannel = channels.find(c => c.id === activeProjChannelId);
  if (!activeChannel && channels.length > 0) {
    activeChannel = channels[0];
  }
  const activeChannelId = activeChannel ? activeChannel.id : null;
  const messages = messageData.channelId === activeChannelId ? messageData.list : [];
  const hasMore = messageData.channelId === activeChannelId && messageData.hasMore;
  const lastId = getLastId(messages);

  const memberIds = getMemberIds(group).filter(id => canSeeProject(group, project, id));
  const members = (users || [])
    .filter(u => memberIds.includes(u.id))
    .map(u => ({ ...u, displayName: getDisplayName(group, u) }));

  const canModerate = hasPermission(group, userId, 'manage_messages');
  const canMentionEveryone = hasPermission(group, userId, 'mention_everyone');

  const mainMessages = messages.filter(m => !m.parentId);
  const threadMsg = messages.find(m => m.id === activeThreadId);
  const threadReplies = messages.filter(m => m.parentId === activeThreadId);
  const lastMain = mainMessages[mainMessages.length - 1];
  const { scrollRef, handleScroll, rememberPosition } = useChatScroll(lastId, lastMain ? lastMain.authorId : null, userId, activeChannelId);
  const locked = readOnly || project.archived;

  useEffect(() => {
    apiGet(projectUrl + '/channels')
      .then(data => {
        setChannels(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectUrl, userId]);

  useEffect(() => {
    if (!activeChannelId) return;

    apiGet(projectUrl + '/channels/' + activeChannelId + '/messages')
      .then(data => setMessageData({ channelId: activeChannelId, list: data.messages, hasMore: data.hasMore }))
      .catch(err => console.error(err.message));
  }, [projectUrl, activeChannelId, userId]);

  useEffect(() => {
    const isThisProject = (data) => data.groupId === groupId && data.projectId === projectId;

    const handleNew = (data) => {
      if (!isThisProject(data) || data.channelId !== activeChannelId) return;
      changeList(setMessageData, prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    };

    const handleUpdated = (data) => {
      if (!isThisProject(data) || data.channelId !== activeChannelId) return;
      changeList(setMessageData, prev => prev.map(m => (m.id === data.message.id ? data.message : m)));
    };

    const handleDeleted = (data) => {
      if (!isThisProject(data) || data.channelId !== activeChannelId) return;
      changeList(setMessageData, prev => prev.filter(m => m.id !== data.messageId && m.parentId !== data.messageId));
    };

    const handleChannelCreated = (data) => {
      if (!isThisProject(data)) return;
      setChannels(prev => {
        if (prev.some(c => c.id === data.channel.id)) return prev;
        return [...prev, data.channel];
      });
    };

    const handleChannelDeleted = (data) => {
      if (!isThisProject(data)) return;
      setChannels(prev => prev.filter(c => c.id !== data.channelId));
      if (activeChannelId === data.channelId) {
        setActiveProjChannelId(null);
      }
    };

    socket.on('project-message:new', handleNew);
    socket.on('project-message:updated', handleUpdated);
    socket.on('project-message:deleted', handleDeleted);
    socket.on('project-channel:created', handleChannelCreated);
    socket.on('project-channel:deleted', handleChannelDeleted);

    return () => {
      socket.off('project-message:new', handleNew);
      socket.off('project-message:updated', handleUpdated);
      socket.off('project-message:deleted', handleDeleted);
      socket.off('project-channel:created', handleChannelCreated);
      socket.off('project-channel:deleted', handleChannelDeleted);
    };
  }, [groupId, projectId, activeChannelId]);

  const saveMessageLocally = (message) => {
    changeList(setMessageData, prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev.map(m => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const data = await apiSend('POST', projectUrl + '/channels', { name: newChannelName });
      setChannels(prev => (prev.some(c => c.id === data.id) ? prev : [...prev, data]));
      setActiveProjChannelId(data.id);
      setNewChannelName('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!window.confirm('ยืนยันการลบห้องนี้? ข้อความทั้งหมดในห้องจะหายไป')) return;
    try {
      await apiSend('DELETE', projectUrl + '/channels/' + channelId);
      setChannels(prev => prev.filter(c => c.id !== channelId));
      if (activeChannelId === channelId) {
        setActiveProjChannelId(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const messageUrl = projectUrl + '/channels/' + activeChannelId + '/messages';

  const sendMessage = async (text, attachments, parentId) => {
    if (!activeChannelId) return false;
    try {
      const data = await apiSend('POST', messageUrl, { text: text, attachments: attachments, parentId: parentId || null });
      saveMessageLocally(data);
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  const editMessage = async (msgId, text) => {
    try {
      const data = await apiSend('PUT', messageUrl + '/' + msgId, { text: text });
      saveMessageLocally(data);
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  const deleteMessage = async (msgId) => {
    if (!window.confirm('ยืนยันการลบข้อความนี้?')) return;
    try {
      await apiSend('DELETE', messageUrl + '/' + msgId);
      changeList(setMessageData, prev => prev.filter(m => m.id !== msgId && m.parentId !== msgId));
      if (activeThreadId === msgId) setActiveThreadId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    try {
      const data = await apiSend('POST', messageUrl + '/' + msgId + '/reactions', { emoji: emoji });
      saveMessageLocally(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const before = encodeURIComponent(getOldestTime(messages));
      const data = await apiGet(messageUrl + '?limit=50&before=' + before);
      rememberPosition();
      setMessageData(prev => ({ channelId: prev.channelId, list: mergeMessages(prev.list, data.messages), hasMore: data.hasMore }));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendPoll = async (poll) => {
    try {
      const data = await apiSend('POST', messageUrl, { text: '', poll: poll });
      saveMessageLocally(data);
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  const vote = async (msgId, optionId) => {
    try {
      const data = await apiSend('POST', messageUrl + '/' + msgId + '/vote', { optionId: optionId });
      saveMessageLocally(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const togglePin = async (msgId) => {
    try {
      const data = await apiSend('POST', messageUrl + '/' + msgId + '/pin', {});
      saveMessageLocally(data);
      setPinsKey(key => key + 1);
    } catch (err) {
      alert(err.message);
    }
  };


  useJumpToMessage({
    focusId: focusMessageId,
    ready: activeChannelId !== null && messageData.channelId === activeChannelId,
    messages: messages,
    hasMore: hasMore,
    loadingOlder: loadingOlder,
    loadOlder: loadOlder,
    onOpenThread: (parentId) => {
      setActiveThreadId(parentId);
      onClosePins();
    }
  });

  if (loading) return <div className="p-6 text-sm text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const typingRoom = 'project:' + projectId + ':' + activeChannelId;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="hidden md:flex w-56 border-r border-slate-200 bg-slate-50/50 flex-col shrink-0">
        <p className="px-4 pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">ห้องแชทของ Project</p>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {channels.map(c => {
            const isActive = activeChannelId === c.id;
            return (
              <div
                key={c.id}
                className={`group flex items-center rounded-lg ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveProjChannelId(c.id)}
                  className="flex-1 text-left px-2.5 h-9 text-sm flex items-center gap-2 truncate font-medium"
                >
                  <Icon name="hash" className="w-4 h-4 opacity-60" />
                  <span className="truncate">{c.name}</span>
                </button>
                {!locked && channels.length > 1 && (
                  <span className="hidden group-hover:block pr-1">
                    <IconButton icon="trash" title="ลบห้อง" size="sm" danger onClick={() => handleDeleteChannel(c.id)} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && !project.archived && (
        <form onSubmit={handleAddChannel} className="p-3 border-t border-slate-200">
          <div className="relative">
            <Icon name="plus" className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="สร้างห้องใหม่"
              className="w-full h-9 text-sm pl-8 pr-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </form>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex gap-2 px-3 py-2 border-b border-slate-200 overflow-x-auto shrink-0">
          {channels.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveProjChannelId(c.id)}
              className={`shrink-0 h-8 px-3 rounded-full text-sm font-medium ${activeChannelId === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              #{c.name}
            </button>
          ))}
        </div>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-1 sm:px-3 py-4">
          <LoadOlderButton hasMore={hasMore} loading={loadingOlder} onClick={loadOlder} />
          {mainMessages.length === 0 && (
            <div className="px-3 pt-6 pb-4">
              <p className="text-lg font-semibold text-slate-900">#{activeChannel ? activeChannel.name : ''}</p>
              <p className="text-sm text-slate-500 mt-1">ยังไม่มีข้อความในห้องนี้ เริ่มคุยกับทีมได้เลย</p>
            </div>
          )}
          <MessageList
            messages={mainMessages}
            allMessages={messages}
            users={users}
            group={group}
            currentUser={currentUser}
            canModerate={canModerate}
            onReply={(id) => { setActiveThreadId(id); onClosePins(); }}
            onEdit={locked ? null : editMessage}
            onDelete={locked ? null : deleteMessage}
            onToggleReaction={locked ? null : toggleReaction}
            onTogglePin={canModerate && !locked ? togglePin : null}
            onVote={locked ? null : vote}
            onOpenProfile={onOpenProfile}
          />
        </div>

        {readOnly ? (
          <div className="px-5 py-4 shrink-0 border-t border-slate-200 text-sm text-slate-500 text-center">โหมดตรวจสอบ: อ่านได้อย่างเดียว ส่งข้อความไม่ได้</div>
        ) : (
        <div className="px-3 sm:px-5 pb-3 sm:pb-4 shrink-0">
          <TypingIndicator room={typingRoom} currentUserId={userId} />
          <ChatInput
            key={typingRoom}
            draftKey={typingRoom}
            onSendPoll={sendPoll}
            onSend={(text, attachments) => sendMessage(text, attachments, null)}
            placeholder={activeChannel ? 'ส่งข้อความใน #' + activeChannel.name : 'พิมพ์ข้อความ...'}
            mentionMembers={members}
            canMentionEveryone={canMentionEveryone}
            currentUser={currentUser}
            typingRoom={typingRoom}
            typingToUserIds={memberIds}
            scheduleTarget={activeChannel ? { target: { type: 'project', groupId: group.id, projectId: project.id, channelId: activeChannel.id }, name: project.name + ' / #' + activeChannel.name } : null}
            timeoutUntil={getTimeoutUntil(group, currentUser.id)}
            lockedText={project.archived ? 'Project นี้ถูกเก็บถาวรแล้ว อ่านได้อย่างเดียว' : ''}
          />
        </div>
        )}
      </div>

      {showPins && activeChannelId && (
        <PinnedPanel
          url={projectUrl + '/channels/' + activeChannelId + '/pins'}
          users={users}
          group={group}
          currentUser={currentUser}
          reloadKey={pinsKey}
          onClose={onClosePins}
          onTogglePin={canModerate && !locked ? togglePin : null}
        />
      )}

      {!showPins && threadMsg && (
        <ThreadPanel
          parentMsg={threadMsg}
          replies={threadReplies}
          users={users}
          group={group}
          currentUser={currentUser}
          mentionMembers={members}
          canMentionEveryone={canMentionEveryone}
          canModerate={canModerate}
          typingRoom={'thread:' + activeThreadId}
          typingToUserIds={memberIds}
          readOnly={locked}
          onClose={() => setActiveThreadId(null)}
          onSend={(text, attachments) => sendMessage(text, attachments, threadMsg.id)}
          onEdit={locked ? null : editMessage}
          onDelete={locked ? null : deleteMessage}
          onToggleReaction={locked ? null : toggleReaction}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}
