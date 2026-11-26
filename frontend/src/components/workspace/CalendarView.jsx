import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { Field, inputClass, textareaClass, ErrorBox } from '../ui/Form';
import { canSeeProject, hasPermission, getDisplayName } from '../../utils/permissions';
import { getAssigneeIds } from '../../utils/tasks';
import { showError, askConfirm } from '../../utils/dialog';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function toKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function keyToDate(key) {
  const parts = key.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function dayTitle(key) {
  const date = keyToDate(key);
  return 'วัน' + ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][date.getDay()] + 'ที่ ' + date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + (date.getFullYear() + 543);
}

function buildMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(date);
  }
  return days;
}

function EventModal({ group, event, defaultDate, onClose }) {
  const [title, setTitle] = useState(event ? event.title : '');
  const [date, setDate] = useState(event ? event.date : defaultDate);
  const [time, setTime] = useState(event ? event.time : '');
  const [description, setDescription] = useState(event ? event.description : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = { title: title, date: date, time: time, description: description };
      if (event) {
        await apiSend('PUT', '/groups/' + group.id + '/events/' + event.id, body);
      } else {
        await apiSend('POST', '/groups/' + group.id + '/events', body);
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={event ? 'แก้ไขนัดหมาย' : 'สร้างนัดหมาย'}
      description={event ? '' : 'สมาชิกทุกคนในกลุ่มจะได้รับแจ้งเตือน'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving}>{event ? 'บันทึก' : 'สร้างนัด'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
        <Field label="ชื่อนัดหมาย">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="เช่น ประชุมทีมประจำสัปดาห์" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="เวลา" hint="เว้นว่างได้ถ้าทั้งวัน">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="รายละเอียด">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={textareaClass} placeholder="วาระ ลิงก์ประชุม หรือสิ่งที่ต้องเตรียม" />
        </Field>
        <ErrorBox message={error} />
      </form>
    </Modal>
  );
}

function dayCellColor(isSelected, inMonth) {
  if (isSelected) return 'bg-indigo-50/70';
  if (inMonth) return 'bg-white hover:bg-slate-50';
  return 'bg-slate-50/60 hover:bg-slate-100/60';
}

function dayNumberColor(isToday, inMonth) {
  if (isToday) return 'bg-indigo-600 text-white';
  if (inMonth) return 'text-slate-800';
  return 'text-slate-400';
}

function taskStatusText(item) {
  if (item.late) return ' · เลยกำหนด';
  if (item.done) return ' · เสร็จแล้ว';
  return ' · ครบกำหนด';
}

export default function CalendarView({ group, currentUser, users, readOnly, initialDate, onOpenProject }) {
  const todayKey = toKey(new Date());
  const startKey = initialDate || todayKey;
  const startDate = keyToDate(startKey);

  const [year, setYear] = useState(startDate.getFullYear());
  const [month, setMonth] = useState(startDate.getMonth());
  const [selectedKey, setSelectedKey] = useState(startKey);
  const [modal, setModal] = useState(null);

  const canManageEvents = hasPermission(group, currentUser.id, 'manage_events');

  const itemsByDay = {};
  const addItem = (key, item) => {
    if (!itemsByDay[key]) itemsByDay[key] = [];
    itemsByDay[key].push(item);
  };

  (group.events || []).forEach(event => {
    addItem(event.date, { kind: 'event', id: event.id, title: event.title, time: event.time, event: event });
  });

  (group.projects || []).forEach(project => {
    if (project.archived) return;
    if (!readOnly && !canSeeProject(group, project, currentUser.id)) return;
    const columns = project.columns || [];
    const lastColumn = columns[columns.length - 1];

    (project.tasks || []).forEach(task => {
      if (!task.dueDate) return;
      const done = lastColumn && task.status === lastColumn.id;
      addItem(task.dueDate, {
        kind: 'task',
        id: task.id,
        title: task.title,
        task: task,
        project: project,
        done: done,
        late: !done && task.dueDate < todayKey
      });
    });
  });

  Object.keys(itemsByDay).forEach(key => {
    itemsByDay[key].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'event' ? -1 : 1;
      return (a.time || '').localeCompare(b.time || '');
    });
  });

  const days = buildMonthDays(year, month);

  const moveMonth = (step) => {
    const next = new Date(year, month + step, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedKey(todayKey);
  };

  const deleteEvent = async (event) => {
    const confirmed = await askConfirm('ลบนัด "' + event.title + '"?');
    if (!confirmed) return;
    try {
      await apiSend('DELETE', '/groups/' + group.id + '/events/' + event.id);
    } catch (err) {
      showError(err.message);
    }
  };

  const chipClass = (item) => {
    if (item.kind === 'event') return 'bg-indigo-50 text-indigo-700';
    if (item.done) return 'bg-emerald-50 text-emerald-700 line-through';
    if (item.late) return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-800';
  };

  const dotClass = (item) => {
    if (item.kind === 'event') return 'bg-indigo-500';
    if (item.done) return 'bg-emerald-500';
    if (item.late) return 'bg-red-500';
    return 'bg-amber-500';
  };

  const selectedItems = itemsByDay[selectedKey] || [];

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-5 lg:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-slate-900 mr-auto">
            {MONTHS[month]} {year + 543}
          </h3>
          <Button variant="secondary" size="sm" onClick={goToday}>วันนี้</Button>
          <IconButton icon="chevronRight" title="เดือนก่อน" onClick={() => moveMonth(-1)} className="rotate-180" />
          <IconButton icon="chevronRight" title="เดือนถัดไป" onClick={() => moveMonth(1)} />
          {!readOnly && <Button size="sm" icon="plus" onClick={() => setModal({ event: null, date: selectedKey })}>สร้างนัด</Button>}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />นัดหมาย</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />งานครบกำหนด</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />งานเลยกำหนด</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />งานเสร็จแล้ว</span>
        </div>

        <div className="grid grid-cols-7 border-l border-t border-slate-200 rounded-xl overflow-hidden">
          {WEEKDAYS.map(name => (
            <div key={name} className="h-8 flex items-center justify-center text-xs font-semibold text-slate-500 bg-slate-50 border-r border-b border-slate-200">
              {name}
            </div>
          ))}
          {days.map(date => {
            const key = toKey(date);
            const items = itemsByDay[key] || [];
            const inMonth = date.getMonth() === month;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedKey(key);
                  if (!inMonth) {
                    setYear(date.getFullYear());
                    setMonth(date.getMonth());
                  }
                }}
                onDoubleClick={() => { if (!readOnly) setModal({ event: null, date: key }); }}
                className={'relative min-h-14 sm:min-h-24 p-1 sm:p-1.5 text-left align-top border-r border-b border-slate-200 transition-colors ' + dayCellColor(isSelected, inMonth)}
              >
                <span
                  className={'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ' + dayNumberColor(isToday, inMonth)}
                >
                  {date.getDate()}
                </span>
                <div className="hidden sm:block mt-0.5 space-y-0.5">
                  {items.slice(0, 3).map(item => (
                    <div key={item.kind + item.id} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${chipClass(item)}`}>
                      {item.kind === 'event' && item.time ? item.time + ' ' : ''}{item.title}
                    </div>
                  ))}
                  {items.length > 3 && <div className="px-1.5 text-[11px] text-slate-500">อีก {items.length - 3} รายการ</div>}
                </div>
                {items.length > 0 && (
                  <div className="sm:hidden flex flex-wrap gap-0.5 mt-0.5 px-0.5">
                    {items.slice(0, 4).map(item => (
                      <span key={item.kind + item.id} className={`w-1.5 h-1.5 rounded-full ${dotClass(item)}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/50 p-4 sm:p-5 lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-slate-900">{dayTitle(selectedKey)}</h4>
          {!readOnly && <IconButton icon="plus" title="สร้างนัดวันนี้" size="sm" onClick={() => setModal({ event: null, date: selectedKey })} />}
        </div>

        {selectedItems.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">ไม่มีนัดหรืองานในวันนี้</p>
        )}

        <div className="space-y-2">
          {selectedItems.map(item => {
            if (item.kind === 'event') {
              const event = item.event;
              const creator = (users || []).find(u => u.id === event.createdBy);
              const canEdit = !readOnly && (event.createdBy === currentUser.id || canManageEvents);
              return (
                <div key={'e' + item.id} className="rounded-xl bg-white border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Icon name="calendar" className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 break-words">{event.title}</p>
                      <p className="text-xs text-indigo-700 font-medium">{event.time ? event.time + ' น.' : 'ทั้งวัน'}</p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0">
                        <IconButton icon="pencil" title="แก้ไขนัด" size="sm" onClick={() => setModal({ event: event, date: event.date })} />
                        <IconButton icon="trash" title="ลบนัด" size="sm" danger onClick={() => deleteEvent(event)} />
                      </div>
                    )}
                  </div>
                  {event.description && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap break-words">{event.description}</p>}
                  {creator && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Avatar src={creator.avatar} name={creator.name} size="xs" />
                      สร้างโดย {getDisplayName(group, creator)}
                    </p>
                  )}
                </div>
              );
            }

            const assignees = getAssigneeIds(item.task).map(id => (users || []).find(u => u.id === id)).filter(Boolean);
            return (
              <button
                key={'t' + item.id}
                type="button"
                onClick={() => onOpenProject(item.project.id)}
                className="w-full text-left rounded-xl bg-white border border-slate-200 p-3 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${chipClass(item).replace('line-through', '')}`}>
                    <Icon name={item.done ? 'check' : 'checkSquare'} className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold text-slate-900 break-words ${item.done ? 'line-through text-slate-500' : ''}`}>{item.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.project.name}
                      {taskStatusText(item)}
                    </p>
                  </div>
                  {assignees.length > 0 && (
                    <span className="flex -space-x-2 shrink-0" title={assignees.map(a => a.name).join(', ')}>
                      {assignees.slice(0, 3).map(person => (
                        <span key={person.id} className="rounded-full ring-2 ring-white">
                          <Avatar src={person.avatar} name={person.name} size="sm" />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {modal && (
        <EventModal
          group={group}
          currentUser={currentUser}
          event={modal.event}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
