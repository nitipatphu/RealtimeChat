import { useState, useEffect } from 'react';
import useChatScroll from '../../hooks/useChatScroll';
import useJumpToMessage from '../../hooks/useJumpToMessage';
import { apiGet, apiSend } from '../../api';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ThreadPanel from './ThreadPanel';
import PinnedPanel from './PinnedPanel';
import TypingIndicator from './TypingIndicator';
import LoadOlderButton from './LoadOlderButton';
import Icon from '../ui/Icon';
import { getMemberIds, getDisplayName, hasPermission, getTimeoutUntil } from '../../utils/permissions';
import { mergeMessages, getOldestTime, getLastId } from '../../utils/messages';
import { showError, askConfirm } from '../../utils/dialog';

export default function ChannelChat({ channel, currentGroup, currentUser, users, setChannels, onOpenProfile, readOnly, showPins, onClosePins, focusMessageId }) {
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pinsKey, setPinsKey] = useState(0);

  const messages = channel.messages || [];
  const mainMessages = messages.filter(m => !m.parentId);
  const threadMsg = messages.find(m => m.id === activeThreadId);
  const threadReplies = messages.filter(m => m.parentId === activeThreadId);
  const lastId = getLastId(messages);
  const lastMain = mainMessages[mainMessages.length - 1];
  const { scrollRef, handleScroll, rememberPosition } = useChatScroll(lastId, lastMain ? lastMain.authorId : null, currentUser.id, channel.id);

  const memberIds = getMemberIds(currentGroup);
  const members = (users || [])
    .filter(u => memberIds.includes(u.id))
    .map(u => ({ ...u, displayName: getDisplayName(currentGroup, u) }));

  const canModerate = hasPermission(currentGroup, currentUser.id, 'manage_messages');
  const canMentionEveryone = hasPermission(currentGroup, currentUser.id, 'mention_everyone');
  const url = '/channels/' + channel.id + '/messages';
  const channelId = channel.id;
  const isLoaded = channel.loaded === true;

  useEffect(() => {
    if (isLoaded) return;
    apiGet('/channels/' + channelId + '/messages?limit=50')
      .then(data => {
        setChannels(prev => prev.map(ch => {
          if (ch.id !== channelId) return ch;
          return { ...ch, loaded: true, hasMore: data.hasMore, messages: mergeMessages(data.messages, ch.messages) };
        }));
      })
      .catch(err => showError(err.message));
  }, [channelId, isLoaded, currentUser.id, setChannels]);

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const before = encodeURIComponent(getOldestTime(messages));
      const data = await apiGet(url + '?limit=50&before=' + before);
      rememberPosition();
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId) return ch;
        return { ...ch, hasMore: data.hasMore, messages: mergeMessages(ch.messages, data.messages) };
      }));
    } catch (err) {
      showError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const saveMessageLocally = (message) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id !== channelId) return ch;
      return { ...ch, messages: mergeMessages(ch.messages, [message]) };
    }));
  };

  const removeMessageLocally = (msgId) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id !== channelId) return ch;
      return { ...ch, messages: (ch.messages || []).filter(m => m.id !== msgId && m.parentId !== msgId) };
    }));
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
      removeMessageLocally(msgId);
      if (activeThreadId === msgId) setActiveThreadId(null);
    } catch (err) {
      showError(err.message);
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    try {
      const data = await apiSend('POST', url + '/' + msgId + '/reactions', { emoji: emoji });
      saveMessageLocally(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const sendPoll = async (poll) => {
    try {
      const data = await apiSend('POST', url, { text: '', poll: poll });
      saveMessageLocally(data);
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    }
  };

  const vote = async (msgId, optionId) => {
    try {
      const data = await apiSend('POST', url + '/' + msgId + '/vote', { optionId: optionId });
      saveMessageLocally(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const togglePin = async (msgId) => {
    try {
      const data = await apiSend('POST', url + '/' + msgId + '/pin', {});
      saveMessageLocally(data);
      setPinsKey(key => key + 1);
    } catch (err) {
      showError(err.message);
    }
  };

  const canPin = canModerate && !readOnly;
  const typingRoom = 'channel:' + channelId;

  useJumpToMessage({
    focusId: focusMessageId,
    ready: isLoaded,
    messages: messages,
    hasMore: channel.hasMore,
    loadingOlder: loadingOlder,
    loadOlder: loadOlder,
    onOpenThread: (parentId) => {
      setActiveThreadId(parentId);
      onClosePins();
    }
  });

  return (
    <div className="flex-1 flex overflow-hidden min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-1 sm:px-3 py-4">
          {isLoaded && !channel.hasMore && (
            <div className="px-3 pt-6 pb-4 mb-2">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Icon name="hash" className="w-6 h-6" />
              </span>
              <p className="text-xl font-semibold text-slate-900">ยินดีต้อนรับสู่ #{channel.name}</p>
              <p className="text-sm text-slate-500 mt-1">นี่คือจุดเริ่มต้นของ Channel นี้ พิมพ์ @ เพื่อกล่าวถึงเพื่อน</p>
            </div>
          )}
          {!isLoaded && <p className="text-center text-sm text-slate-400 py-10">กำลังโหลดข้อความ...</p>}

          <LoadOlderButton hasMore={channel.hasMore} loading={loadingOlder} onClick={loadOlder} />

          <MessageList
            messages={mainMessages}
            allMessages={messages}
            users={users}
            group={currentGroup}
            currentUser={currentUser}
            canModerate={canModerate}
            onReply={(id) => { setActiveThreadId(id); onClosePins(); }}
            onEdit={readOnly ? null : editMessage}
            onDelete={readOnly ? null : deleteMessage}
            onToggleReaction={readOnly ? null : toggleReaction}
            onTogglePin={canPin ? togglePin : null}
            onVote={readOnly ? null : vote}
            onOpenProfile={onOpenProfile}
          />
        </div>

        {readOnly ? (
          <div className="px-5 py-4 shrink-0 border-t border-slate-200 text-sm text-slate-500 text-center">โหมดตรวจสอบ: อ่านได้อย่างเดียว ส่งข้อความไม่ได้</div>
        ) : (
          <div className="px-3 sm:px-5 pb-3 sm:pb-4 shrink-0">
            <TypingIndicator room={typingRoom} currentUserId={currentUser.id} />
            <ChatInput
              onSend={(text, attachments) => sendMessage(text, attachments, null)}
              placeholder={'ส่งข้อความถึง #' + channel.name}
              mentionMembers={members}
              canMentionEveryone={canMentionEveryone}
              currentUser={currentUser}
              typingRoom={typingRoom}
              typingToUserIds={memberIds}
              draftKey={typingRoom}
              onSendPoll={sendPoll}
              scheduleTarget={{ target: { type: 'channel', channelId: channel.id }, name: '#' + channel.name }}
              timeoutUntil={getTimeoutUntil(currentGroup, currentUser.id)}
            />
          </div>
        )}
      </div>

      {showPins && (
        <PinnedPanel
          url={'/channels/' + channelId + '/pins'}
          users={users}
          group={currentGroup}
          currentUser={currentUser}
          reloadKey={pinsKey}
          onClose={onClosePins}
          onTogglePin={canPin ? togglePin : null}
        />
      )}

      {!showPins && threadMsg && (
        <ThreadPanel
          parentMsg={threadMsg}
          replies={threadReplies}
          users={users}
          group={currentGroup}
          currentUser={currentUser}
          mentionMembers={members}
          canMentionEveryone={canMentionEveryone}
          canModerate={canModerate}
          typingRoom={'thread:' + activeThreadId}
          typingToUserIds={memberIds}
          readOnly={readOnly}
          onClose={() => setActiveThreadId(null)}
          onSend={(text, attachments) => sendMessage(text, attachments, threadMsg.id)}
          onEdit={readOnly ? null : editMessage}
          onDelete={readOnly ? null : deleteMessage}
          onToggleReaction={readOnly ? null : toggleReaction}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}
