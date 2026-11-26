import { useState, useEffect } from 'react';
import useChatScroll from '../../hooks/useChatScroll';
import TypingIndicator from '../chat/TypingIndicator';
import socket from '../../socket';
import { apiGet, apiSend } from '../../api';
import MessageList from '../chat/MessageList';
import ChatInput from '../chat/ChatInput';
import LoadOlderButton from '../chat/LoadOlderButton';
import ThreadPanel from '../chat/ThreadPanel';
import { mergeMessages, getOldestTime, getLastId } from '../../utils/messages';
import { showError, askConfirm } from '../../utils/dialog';

export default function GroupChatView({ chat, currentUser, users, onOpenProfile }) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [error, setError] = useState('');

  const chatId = chat.id;
  const url = '/conversations/' + chatId + '/messages';
  const mainMessages = messages.filter(m => !m.parentId);
  const lastId = getLastId(mainMessages);
  const threadMsg = messages.find(m => m.id === activeThreadId);
  const threadReplies = messages.filter(m => m.parentId === activeThreadId);
  const lastMain = mainMessages[mainMessages.length - 1];
  const { scrollRef, handleScroll, rememberPosition } = useChatScroll(lastId, lastMain ? lastMain.authorId : null, currentUser.id, chat.id);

  useEffect(() => {
    apiGet(url)
      .then(data => {
        setMessages(data.messages);
        setHasMore(data.hasMore);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [url, currentUser.id]);

  useEffect(() => {
    const handleNew = (data) => {
      if (data.conversationId !== chatId) return;
      setMessages(prev => mergeMessages(prev, [data.message]));
    };
    const handleUpdated = (data) => {
      if (data.conversationId !== chatId) return;
      setMessages(prev => prev.map(m => (m.id === data.message.id ? data.message : m)));
    };
    const handleDeleted = (data) => {
      if (data.conversationId !== chatId) return;
      setMessages(prev => prev.filter(m => m.id !== data.messageId && m.parentId !== data.messageId));
    };

    socket.on('gdm:new', handleNew);
    socket.on('gdm:updated', handleUpdated);
    socket.on('gdm:deleted', handleDeleted);
    return () => {
      socket.off('gdm:new', handleNew);
      socket.off('gdm:updated', handleUpdated);
      socket.off('gdm:deleted', handleDeleted);
    };
  }, [chatId]);

  const saveLocally = (message) => {
    setMessages(prev => mergeMessages(prev, [message]));
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const before = encodeURIComponent(getOldestTime(messages));
      const data = await apiGet(url + '?before=' + before);
      rememberPosition();
      setMessages(prev => mergeMessages(prev, data.messages));
      setHasMore(data.hasMore);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendMessage = async (text, attachments, parentId) => {
    try {
      const data = await apiSend('POST', url, { text: text, attachments: attachments, parentId: parentId || null });
      saveLocally(data);
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    }
  };

  const editMessage = async (msgId, text) => {
    try {
      const data = await apiSend('PUT', url + '/' + msgId, { text: text });
      saveLocally(data);
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    }
  };

  const deleteMessage = async (msgId) => {
    const confirmed = await askConfirm('ยืนยันการลบข้อความนี้?');
    if (!confirmed) return;
    try {
      await apiSend('DELETE', url + '/' + msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId && m.parentId !== msgId));
      if (activeThreadId === msgId) setActiveThreadId(null);
    } catch (err) {
      showError(err.message);
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    try {
      const data = await apiSend('POST', url + '/' + msgId + '/reactions', { emoji: emoji });
      saveLocally(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const members = (users || []).filter(u => chat.participants.includes(u.id));

  return (
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-1 sm:px-3 py-4">
        {loading && <p className="text-center py-16 text-slate-400 text-sm">กำลังโหลด...</p>}
        {error && <p className="text-center py-16 text-red-600 text-sm">{error}</p>}
        {!loading && !error && !hasMore && (
          <div className="px-3 pt-6 pb-4 mb-2">
            <p className="text-xl font-semibold text-slate-900">{chat.name || 'แชทกลุ่ม'}</p>
            <p className="text-sm text-slate-500 mt-1">จุดเริ่มต้นของแชทกลุ่มนี้ มีสมาชิก {chat.participants.length} คน</p>
          </div>
        )}

        <LoadOlderButton hasMore={hasMore} loading={loadingOlder} onClick={loadOlder} />

        <MessageList
          messages={mainMessages}
          allMessages={messages}
          users={users}
          group={null}
          currentUser={currentUser}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onToggleReaction={toggleReaction}
          onReply={(id) => setActiveThreadId(id)}
          onOpenProfile={onOpenProfile}
        />
      </div>

      <div className="px-3 sm:px-5 pb-3 sm:pb-4 shrink-0">
        <TypingIndicator room={'gdm:' + chatId} currentUserId={currentUser.id} />
        <ChatInput
          onSend={(text, attachments) => sendMessage(text, attachments, null)}
          placeholder={'ส่งข้อความถึง ' + (chat.name || 'แชทกลุ่ม')}
          mentionMembers={members}
          currentUser={currentUser}
          draftKey={'gdm:' + chatId}
          typingRoom={'gdm:' + chatId}
          typingToUserIds={chat.participants}
          scheduleTarget={{ target: { type: 'gdm', conversationId: chatId }, name: chat.name || 'แชทกลุ่ม' }}
        />
      </div>
    </div>

      {threadMsg && (
        <ThreadPanel
          parentMsg={threadMsg}
          replies={threadReplies}
          users={users}
          group={null}
          currentUser={currentUser}
          mentionMembers={members}
          typingRoom={'thread:' + activeThreadId}
          typingToUserIds={chat.participants.filter(id => id !== currentUser.id)}
          onClose={() => setActiveThreadId(null)}
          onSend={(text, attachments) => sendMessage(text, attachments, threadMsg.id)}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onToggleReaction={toggleReaction}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}
