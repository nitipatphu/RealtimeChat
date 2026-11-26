import { useContext, useState, useEffect } from 'react';
import useChatScroll from '../../hooks/useChatScroll';
import useJumpToMessage from '../../hooks/useJumpToMessage';
import socket from '../../socket';
import { apiGet, apiSend } from '../../api';
import MessageList from '../chat/MessageList';
import ChatInput from '../chat/ChatInput';
import TypingIndicator from '../chat/TypingIndicator';
import ThreadPanel from '../chat/ThreadPanel';
import Avatar from '../ui/Avatar';
import LoadOlderButton from '../chat/LoadOlderButton';
import { mergeMessages, getOldestTime, getLastId } from '../../utils/messages';
import BlockedContext from '../../blockedContext';
import { showError, askConfirm } from '../../utils/dialog';

export default function DirectMessageView({ otherUser, currentUser, users, onOpenProfile, focusMessageId }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const blockedIds = useContext(BlockedContext);

  const url = '/dms/' + otherUser.id + '/messages';
  const mainMessages = messages.filter(m => !m.parentId);
  const lastId = getLastId(mainMessages);
  const threadMsg = messages.find(m => m.id === activeThreadId);
  const threadReplies = messages.filter(m => m.parentId === activeThreadId);
  const isBlocked = blockedIds.includes(otherUser.id);
  const lastMain = mainMessages[mainMessages.length - 1];
  const { scrollRef, handleScroll, rememberPosition } = useChatScroll(lastId, lastMain ? lastMain.authorId : null, currentUser.id, otherUser.id);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiGet(url);
        setConversationId(data.conversationId);
        setMessages(data.messages);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [url, currentUser.id]);

  useEffect(() => {
    if (!conversationId) return;

    const handleNew = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    };

    const handleUpdated = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages(prev => prev.map(m => (m.id === data.message.id ? data.message : m)));
    };

    const handleDeleted = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages(prev => prev.filter(m => m.id !== data.messageId && m.parentId !== data.messageId));
    };

    socket.on('dm:new', handleNew);
    socket.on('dm:updated', handleUpdated);
    socket.on('dm:deleted', handleDeleted);

    return () => {
      socket.off('dm:new', handleNew);
      socket.off('dm:updated', handleUpdated);
      socket.off('dm:deleted', handleDeleted);
    };
  }, [conversationId]);

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

  const saveMessageLocally = (message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev.map(m => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  };

  const sendMessage = async (text, attachments, parentId) => {
    try {
      const data = await apiSend('POST', url, { text: text, attachments: attachments, parentId: parentId || null });
      saveMessageLocally(data);
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    }
  };

  const editMessage = async (msgId, text) => {
    try {
      const data = await apiSend('PUT', url + '/' + msgId, { text: text });
      saveMessageLocally(data);
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

  useJumpToMessage({
    focusId: focusMessageId,
    ready: !loading,
    messages: messages,
    hasMore: hasMore,
    loadingOlder: loadingOlder,
    loadOlder: loadOlder,
    onOpenThread: setActiveThreadId
  });

  return (
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-1 sm:px-3 py-4">
        {loading && <p className="text-center py-16 text-slate-400 text-sm">กำลังโหลด...</p>}
        {!loading && error && <p className="text-center py-16 text-red-600 text-sm">{error}</p>}

        {!loading && !error && !hasMore && (
          <div className="px-3 pt-6 pb-4 mb-2">
            <Avatar src={otherUser.avatar} name={otherUser.name} size="xl" />
            <p className="text-xl font-semibold text-slate-900 mt-3">{otherUser.name}</p>
            {otherUser.title && <p className="text-sm text-slate-500">{otherUser.title}</p>}
            <p className="text-sm text-slate-500 mt-2">นี่คือจุดเริ่มต้นของข้อความส่วนตัวระหว่างคุณกับ {otherUser.name}</p>
          </div>
        )}

        <LoadOlderButton hasMore={hasMore} loading={loadingOlder} onClick={loadOlder} />

        {!loading && !error && (
          <MessageList
            messages={mainMessages}
            allMessages={messages}
            users={users}
            group={null}
            currentUser={currentUser}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onReply={(id) => setActiveThreadId(id)}
            onOpenProfile={onOpenProfile}
          />
        )}
      </div>

      <div className="px-3 sm:px-5 pb-3 sm:pb-4 shrink-0">
        <TypingIndicator room={'dm:' + otherUser.id} currentUserId={currentUser.id} />
        <ChatInput
          onSend={(text, attachments) => sendMessage(text, attachments, null)}
          placeholder={'ส่งข้อความถึง ' + otherUser.name}
          currentUser={currentUser}
          typingRoom={'dm:' + currentUser.id}
          typingToUserIds={[otherUser.id]}
          draftKey={'dm:' + otherUser.id}
          scheduleTarget={{ target: { type: 'dm', otherUserId: otherUser.id }, name: otherUser.name }}
          lockedText={isBlocked ? 'คุณบล็อกผู้ใช้นี้อยู่ ปลดบล็อกได้ที่หน้าโปรไฟล์' : ''}
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
          typingRoom={'thread:' + activeThreadId}
          typingToUserIds={[otherUser.id]}
          readOnly={isBlocked}
          onClose={() => setActiveThreadId(null)}
          onSend={(text, attachments) => sendMessage(text, attachments, threadMsg.id)}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}
