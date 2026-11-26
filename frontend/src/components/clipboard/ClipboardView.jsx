import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { PageHeader, EmptyState } from '../ui/Card';
import { Field, ErrorBox, inputClass, inputBaseClass, textareaClass } from '../ui/Form';
import { timeAgo } from '../../utils/format';
import { copyText } from '../../utils/clipboard';
import { showAlert, showError, askConfirm } from '../../utils/dialog';

function ClipModal({ clip, currentUser, onClose, onSaved }) {
  const [title, setTitle] = useState(clip ? clip.title : '');
  const [text, setText] = useState(clip ? clip.text : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (clip) {
        await apiSend('PUT', '/users/' + currentUser.id + '/clips/' + clip.id, { title: title, text: text });
      } else {
        await apiSend('POST', '/users/' + currentUser.id + '/clips', { title: title, text: text });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={clip ? 'แก้ไขข้อความ' : 'เพิ่มข้อความลงคลิปบอร์ด'}
      description="เห็นได้เฉพาะคุณคนเดียว"
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving || !text.trim()}>{clip ? 'บันทึก' : 'เพิ่ม'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="ชื่อ (ไม่บังคับ)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={inputClass} placeholder="เช่น ลิงก์ประชุม, เลขบัญชี, คำตอบที่ใช้บ่อย" />
        </Field>
        <Field label="ข้อความ">
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={5000} className={textareaClass + ' font-mono text-sm'} placeholder="วางหรือพิมพ์ข้อความที่อยากเก็บไว้" />
        </Field>
        <p className="text-xs text-slate-400 text-right">{text.length}/5000</p>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export default function ClipboardView({ currentUser }) {
  const [clips, setClips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiGet('/users/' + currentUser.id + '/clips')
      .then(data => {
        setClips(data);
        setLoaded(true);
      })
      .catch(err => showError(err.message));
  }, [currentUser.id, reloadKey]);

  const reload = () => setReloadKey(reloadKey + 1);

  const copy = (clip) => {
    copyText(clip.text);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(''), 1500);
  };

  const togglePin = async (clip) => {
    try {
      await apiSend('PUT', '/users/' + currentUser.id + '/clips/' + clip.id, { pinned: !clip.pinned });
      reload();
    } catch (err) {
      showError(err.message);
    }
  };

  const remove = async (clip) => {
    const confirmed = await askConfirm('ลบ "' + (clip.title || clip.text.slice(0, 30)) + '" ออกจากคลิปบอร์ด?');
    if (!confirmed) return;
    try {
      await apiSend('DELETE', '/users/' + currentUser.id + '/clips/' + clip.id);
      reload();
    } catch (err) {
      showError(err.message);
    }
  };

  const pasteFromDevice = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showAlert('คลิปบอร์ดของเครื่องว่างอยู่');
        return;
      }
      await apiSend('POST', '/users/' + currentUser.id + '/clips', { title: '', text: text });
      reload();
    } catch (error) {
      console.log(error);
      setModal({ clip: null });
    }
  };

  const query = search.trim().toLowerCase();
  const shown = clips.filter(c => !query || c.text.toLowerCase().includes(query) || (c.title || '').toLowerCase().includes(query));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <PageHeader
          title="คลิปบอร์ดของฉัน"
          description="เก็บข้อความที่ใช้บ่อยไว้คัดลอกหรือแทรกในแชทได้ทันที เห็นได้เฉพาะคุณคนเดียว"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" icon="clipboard" onClick={pasteFromDevice}>วางจากเครื่อง</Button>
              <Button icon="plus" onClick={() => setModal({ clip: null })}>เพิ่มข้อความ</Button>
            </div>
          }
        />

        <div className="relative mb-4">
          <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาในคลิปบอร์ด..." className={inputBaseClass + ' w-full h-10 pl-9'} />
        </div>

        {loaded && clips.length === 0 && (
          <EmptyState icon="clipboard" title="ยังไม่มีข้อความในคลิปบอร์ด" text="กด เพิ่มข้อความ หรือกดไอคอนคลิปบอร์ดที่ข้อความในแชทเพื่อเก็บไว้" />
        )}
        {loaded && clips.length > 0 && shown.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">ไม่พบข้อความที่ตรงกับ "{search}"</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {shown.map(clip => (
            <div key={clip.id} className={`group flex flex-col rounded-2xl border bg-white p-4 ${clip.pinned ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {clip.pinned && <Icon name="bookmark" className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                    {clip.title || 'ไม่มีชื่อ'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {clip.source ? 'จาก ' + clip.source + ' · ' : ''}แก้ไข {timeAgo(clip.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <IconButton icon="bookmark" title={clip.pinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้บนสุด'} size="sm" active={clip.pinned} onClick={() => togglePin(clip)} />
                  <IconButton icon="pencil" title="แก้ไข" size="sm" onClick={() => setModal({ clip: clip })} />
                  <IconButton icon="trash" title="ลบ" size="sm" danger onClick={() => remove(clip)} />
                </div>
              </div>
              <pre className="mt-2 flex-1 max-h-40 overflow-hidden whitespace-pre-wrap break-words font-sans text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{clip.text}</pre>
              <Button
                variant={copiedId === clip.id ? 'secondary' : 'secondary'}
                size="sm"
                icon={copiedId === clip.id ? 'check' : 'copy'}
                onClick={() => copy(clip)}
                className="mt-3 self-start"
              >
                {copiedId === clip.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {modal && <ClipModal clip={modal.clip} currentUser={currentUser} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  );
}
