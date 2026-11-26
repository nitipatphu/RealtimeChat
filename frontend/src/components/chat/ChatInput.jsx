import { useState, useRef, useEffect } from 'react';
import socket from '../../socket';
import { apiUpload } from '../../api';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import EmojiPicker from '../ui/EmojiPicker';
import PollModal from '../modals/PollModal';
import ScheduleModal from '../modals/ScheduleModal';
import ClipPicker from '../clipboard/ClipPicker';
import { getPerks, getTierSettings } from '../../utils/vip';

function loadDraft(draftKey) {
  if (!draftKey) return '';
  return localStorage.getItem('draft:' + draftKey) || '';
}

function saveDraft(draftKey, value) {
  if (!draftKey) return;
  if (value) {
    localStorage.setItem('draft:' + draftKey, value);
  } else {
    localStorage.removeItem('draft:' + draftKey);
  }
}

export default function ChatInput({
  onSend,
  placeholder,
  mentionMembers,
  canMentionEveryone,
  currentUser,
  typingRoom,
  typingToUserIds,
  compact,
  draftKey,
  onSendPoll,
  scheduleTarget,
  lockedText,
  timeoutUntil
}) {
  const [text, setText] = useState(loadDraft(draftKey));
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showClips, setShowClips] = useState(false);
  const [scheduledNote, setScheduledNote] = useState('');
  const [timeoutEndedFor, setTimeoutEndedFor] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionEnd, setMentionEnd] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textRef = useRef(null);
  const fileRef = useRef(null);
  const lastTypingTime = useRef(0);

  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.style.height = 'auto';
    textRef.current.style.height = Math.min(textRef.current.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => {
    if (!timeoutUntil) return;
    const waitMs = new Date(timeoutUntil).getTime() - Date.now();
    if (waitMs <= 0) return;
    const timer = setTimeout(() => setTimeoutEndedFor(timeoutUntil), waitMs + 500);
    return () => clearTimeout(timer);
  }, [timeoutUntil]);

  const updateText = (value) => {
    setText(value);
    saveDraft(draftKey, value);
  };

  const insertAtCursor = (before, after) => {
    const box = textRef.current;
    const start = box ? box.selectionStart : text.length;
    const end = box ? box.selectionEnd : text.length;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + (after || '') + text.slice(end);
    updateText(newText);

    setTimeout(() => {
      if (!textRef.current) return;
      textRef.current.focus();
      const caret = start + before.length + selected.length;
      textRef.current.setSelectionRange(caret, caret);
    }, 0);
  };

  let suggestions = [];
  if (mentionQuery !== null && mentionMembers) {
    const query = mentionQuery.toLowerCase();
    const others = mentionMembers.filter(m => !currentUser || m.id !== currentUser.id);
    suggestions = others
      .filter(m => m.name.toLowerCase().includes(query) || (m.displayName || '').toLowerCase().includes(query))
      .slice(0, 6);

    if (canMentionEveryone && 'everyone'.includes(query) && others.length > 0) {
      suggestions.push({ id: 'everyone', name: 'everyone', isEveryone: true });
    }
  }

  const sendTyping = () => {
    if (!typingRoom || !typingToUserIds || !currentUser) return;

    const now = Date.now();
    if (now - lastTypingTime.current < 2000) return;
    lastTypingTime.current = now;

    socket.emit('typing', { room: typingRoom, toUserIds: typingToUserIds, name: currentUser.name });
  };

  const resizeBox = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 200) + 'px';
  };

  const handleChange = (e) => {
    const value = e.target.value;
    updateText(value);
    resizeBox(e.target);
    sendTyping();

    if (!mentionMembers) return;

    const caret = e.target.selectionStart;
    const beforeCaret = value.slice(0, caret);
    const atIndex = beforeCaret.lastIndexOf('@');
    const query = atIndex === -1 ? '' : beforeCaret.slice(atIndex + 1);
    const hasSpace = query.includes(' ') || query.includes('\n');

    if (atIndex !== -1 && !hasSpace) {
      setMentionQuery(query);
      setMentionStart(atIndex);
      setMentionEnd(caret);
      setSelectedIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const pickMention = (member) => {
    const newText = text.slice(0, mentionStart) + '@' + member.name + ' ' + text.slice(mentionEnd);
    const newCaret = mentionStart + member.name.length + 2;

    updateText(newText);
    setMentionQuery(null);

    setTimeout(() => {
      if (textRef.current) {
        textRef.current.focus();
        textRef.current.setSelectionRange(newCaret, newCaret);
      }
    }, 0);
  };

  const handleSend = async () => {
    if (sending || uploading) return;
    if (!text.trim() && attachments.length === 0) return;

    setSending(true);
    const ok = await onSend(text, attachments);
    setSending(false);

    if (ok) {
      updateText('');
      setAttachments([]);
      setMentionQuery(null);
      if (textRef.current) textRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((selectedIndex + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((selectedIndex - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(suggestions[selectedIndex] || suggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = async (e) => {
    const files = [];
    for (let i = 0; i < e.target.files.length; i++) {
      files.push(e.target.files[i]);
    }
    e.target.value = '';
    if (files.length === 0) return;

    if (attachments.length + files.length > 5) {
      alert('แนบไฟล์ได้สูงสุด 5 ไฟล์ต่อข้อความ');
      return;
    }

    setUploading(true);
    for (const file of files) {
      const limitMB = getPerks(currentUser).fileMB;
      const biggest = Math.max(getTierSettings().vip.fileMB, getTierSettings().supervip.fileMB);
      if (file.size > limitMB * 1024 * 1024) {
        alert(file.name + ' ใหญ่เกิน ' + limitMB + ' MB' + (biggest > limitMB ? ' (อัปเกรด VIP เพื่อส่งไฟล์ใหญ่ขึ้น)' : ''));
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      try {
        const data = await apiUpload('/uploads', formData);
        setAttachments(prev => [...prev, data]);
      } catch (err) {
        alert(file.name + ': ' + err.message);
      }
    }
    setUploading(false);
  };

  const startMention = () => {
    const newText = text + (text && !text.endsWith(' ') ? ' @' : '@');
    updateText(newText);
    setMentionQuery('');
    setMentionStart(newText.length - 1);
    setMentionEnd(newText.length);
    setSelectedIndex(0);
    if (textRef.current) textRef.current.focus();
  };

  const canSend = (text.trim() || attachments.length > 0) && !sending && !uploading;

  let lockMessage = lockedText || '';
  if (!lockMessage && timeoutUntil && timeoutEndedFor !== timeoutUntil) {
    const time = new Date(timeoutUntil).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    lockMessage = 'คุณถูก Timeout ในกลุ่มนี้ ส่งข้อความได้อีกครั้งหลัง ' + time + ' น.';
  }

  if (lockMessage) {
    return (
      <div className="flex items-center gap-2.5 px-4 h-12 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        <Icon name={timeoutUntil && !lockedText ? 'clock' : 'lock'} className="w-4 h-4 shrink-0" />
        <span className="truncate">{lockMessage}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <div className="absolute left-0 bottom-full mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30">
          <p className="px-3 pb-1 text-xs font-medium text-slate-400">กล่าวถึงสมาชิก</p>
          {suggestions.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(member);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm ${
                index === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {member.isEveryone ? (
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <Icon name="users" className="w-4 h-4" />
                </span>
              ) : (
                <Avatar src={member.avatar} name={member.name} size="sm" />
              )}
              <span className="font-medium truncate">{member.isEveryone ? '@everyone' : member.displayName || member.name}</span>
              {!member.isEveryone && member.displayName && member.displayName !== member.name && (
                <span className="text-xs text-slate-400 truncate">{member.name}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map(file => (
              <span key={file.url} className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg pl-2.5 pr-1 h-8">
                <Icon name={(file.type || '').startsWith('image/') ? 'eye' : 'file'} className="w-4 h-4 text-slate-500" />
                <span className="truncate max-w-[160px]">{file.name}</span>
                <IconButton icon="x" title="เอาออก" size="sm" onClick={() => setAttachments(prev => prev.filter(a => a.url !== file.url))} />
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={textRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          rows={1}
          placeholder={placeholder}
          className={`w-full text-[15px] text-slate-800 bg-transparent focus:outline-none resize-none px-4 ${compact ? 'pt-2.5' : 'pt-3'} placeholder:text-slate-400`}
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
            <IconButton icon="paperclip" title={'แนบไฟล์ (สูงสุด ' + getPerks(currentUser).fileMB + ' MB)'} size="sm" onClick={() => fileRef.current && fileRef.current.click()} />
            {mentionMembers && <IconButton icon="at" title="กล่าวถึงสมาชิก" size="sm" onClick={startMention} />}
            <div className="relative">
              <IconButton icon="smile" title="อีโมจิ" size="sm" onClick={() => setShowEmoji(!showEmoji)} />
              {showEmoji && (
                <EmojiPicker
                  position="left-0 bottom-full mb-2"
                  onClose={() => setShowEmoji(false)}
                  onPick={(emoji) => {
                    setShowEmoji(false);
                    insertAtCursor(emoji);
                  }}
                />
              )}
            </div>
            <span className="hidden sm:flex items-center">
              <IconButton icon="bold" title="ตัวหนา **ข้อความ**" size="sm" onClick={() => insertAtCursor('**', '**')} />
              <IconButton icon="italic" title="ตัวเอียง *ข้อความ*" size="sm" onClick={() => insertAtCursor('*', '*')} />
              <IconButton icon="code" title="โค้ด `โค้ด`" size="sm" onClick={() => insertAtCursor('`', '`')} />
            </span>
            {currentUser && (
              <div className="relative">
                <IconButton icon="clipboard" title="แทรกจากคลิปบอร์ดของฉัน" size="sm" active={showClips} onClick={() => setShowClips(!showClips)} />
                {showClips && (
                  <ClipPicker
                    currentUser={currentUser}
                    onClose={() => setShowClips(false)}
                    onPick={(clipText) => {
                      setShowClips(false);
                      insertAtCursor(clipText);
                    }}
                  />
                )}
              </div>
            )}
            {onSendPoll && <IconButton icon="poll" title="สร้างโพล" size="sm" onClick={() => setShowPoll(true)} />}
            {scheduleTarget && <IconButton icon="clock" title="ตั้งเวลาส่งข้อความ" size="sm" onClick={() => setShowSchedule(true)} />}
            {scheduledNote && <span className="text-xs text-emerald-600 ml-1">{scheduledNote}</span>}
            {uploading && <span className="text-xs text-slate-400 ml-1">กำลังอัปโหลด...</span>}
          </div>
          <div className="flex items-center gap-2">
            {!compact && <span className="hidden sm:inline text-xs text-slate-400">Shift + Enter ขึ้นบรรทัดใหม่</span>}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              title="ส่ง"
              className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              <Icon name="send" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {showPoll && <PollModal onClose={() => setShowPoll(false)} onCreate={onSendPoll} />}
      {showSchedule && (
        <ScheduleModal
          text={text}
          currentUser={currentUser}
          target={scheduleTarget.target}
          targetName={scheduleTarget.name}
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            updateText('');
            setScheduledNote('ตั้งเวลาแล้ว');
            setTimeout(() => setScheduledNote(''), 3000);
          }}
        />
      )}
    </div>
  );
}
