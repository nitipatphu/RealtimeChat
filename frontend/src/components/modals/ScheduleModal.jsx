import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { Field, inputClass, ErrorBox } from '../ui/Form';
import { formatDateTime } from '../../utils/format';
import { showError } from '../../utils/dialog';

function toInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function makeQuickTimes() {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const tonight = new Date();
  tonight.setHours(20, 0, 0, 0);
  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  const list = [{ label: 'อีก 1 ชั่วโมง', date: inOneHour }];
  if (tonight.getTime() > Date.now() + 5 * 60 * 1000) {
    list.push({ label: 'คืนนี้ 20:00', date: tonight });
  }
  list.push({ label: 'พรุ่งนี้ 09:00', date: tomorrowMorning });
  return list;
}

export default function ScheduleModal({ text, currentUser, target, targetName, onClose, onScheduled }) {
  const [sendAt, setSendAt] = useState(() => toInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [quickTimes] = useState(() => makeQuickTimes());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  const targetText = JSON.stringify(target);

  useEffect(() => {
    apiGet('/scheduled?target=' + encodeURIComponent(targetText))
      .then(data => setList(data))
      .catch(() => setList([]));
  }, [currentUser.id, targetText, reloadKey]);

  const save = async () => {
    if (!text.trim()) {
      setError('พิมพ์ข้อความในช่องแชทก่อน แล้วค่อยกดตั้งเวลา');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiSend('POST', '/scheduled', {
        text: text,
        sendAt: new Date(sendAt).toISOString(),
        target: target,
        targetName: targetName
      });
      onScheduled();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelItem = async (item) => {
    try {
      await apiSend('DELETE', '/scheduled/' + item.id);
      setReloadKey(reloadKey + 1);
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <Modal
      title="ตั้งเวลาส่งข้อความ"
      description={'ส่งไปที่ ' + targetName}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ปิด</Button>
          <Button icon="clock" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'ตั้งเวลา'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
          {text.trim() ? text : <span className="text-slate-400">ยังไม่ได้พิมพ์ข้อความ</span>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickTimes.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSendAt(toInputValue(item.date))}
              className={`h-8 px-3 rounded-full border text-xs font-medium ${
                sendAt === toInputValue(item.date) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Field label="วันและเวลาที่จะส่ง">
          <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className={inputClass} />
        </Field>

        <ErrorBox message={error} />

        {list.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">ตั้งเวลาไว้ในห้องนี้ ({list.length})</p>
            <div className="space-y-1.5">
              {list.map(item => (
                <div key={item.id} className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
                  <Icon name="clock" className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-indigo-700">{formatDateTime(item.sendAt)}</p>
                    <p className="text-sm text-slate-700 truncate">{item.text}</p>
                  </div>
                  <IconButton icon="trash" title="ยกเลิกข้อความนี้" size="sm" danger onClick={() => cancelItem(item)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
