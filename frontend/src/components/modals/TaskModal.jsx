import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button, { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { Field, ErrorBox, inputClass, textareaClass } from '../ui/Form';
import { timeAgo } from '../../utils/format';
import { getAssigneeIds } from '../../utils/tasks';
import { showError, askConfirm } from '../../utils/dialog';

export default function TaskModal({ task, columns, members, onSave, onDelete, onClose, groupId, projectId, users, readOnly }) {
  const [checklist, setChecklist] = useState(task.checklist || []);
  const [newItem, setNewItem] = useState('');
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const addItem = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setChecklist([...checklist, { id: 'k' + Date.now(), text: newItem.trim().slice(0, 120), done: false }]);
    setNewItem('');
  };

  const toggleItem = (itemId) => {
    setChecklist(checklist.map(item => (item.id === itemId ? { ...item, done: !item.done } : item)));
  };

  const removeItem = (itemId) => {
    setChecklist(checklist.filter(item => item.id !== itemId));
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      await apiSend('POST', '/groups/' + groupId + '/projects/' + projectId + '/tasks/' + task.id + '/comments', { text: comment });
      setComment('');
    } catch (err) {
      showError(err.message);
    } finally {
      setSendingComment(false);
    }
  };

  const doneCount = checklist.filter(item => item.done).length;
  const comments = task.comments || [];
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [assigneeIds, setAssigneeIds] = useState(getAssigneeIds(task));

  const toggleAssignee = (memberId) => {
    if (assigneeIds.includes(memberId)) {
      setAssigneeIds(assigneeIds.filter(id => id !== memberId));
    } else {
      setAssigneeIds([...assigneeIds, memberId]);
    }
  };
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [priority, setPriority] = useState(task.priority || '');
  const [status, setStatus] = useState(task.status);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      setError('กรุณาใส่ชื่องาน');
      return;
    }

    onSave({
      ...task,
      title: title.trim(),
      description: description.trim(),
      assigneeIds: assigneeIds,
      dueDate: dueDate || null,
      priority: priority || null,
      status: status,
      checklist: checklist
    });
  };

  const handleDelete = async () => {
    const confirmed = await askConfirm('ยืนยันการลบงานนี้?');
    if (!confirmed) return;
    onDelete(task.id);
  };

  return (
    <Modal
      title="รายละเอียดงาน"
      onClose={onClose}
      width="max-w-2xl"
      footer={readOnly ? null : (
        <div className="flex w-full justify-between">
          <Button variant="dangerSoft" icon="trash" onClick={handleDelete}>ลบงาน</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
            <Button onClick={handleSave}>บันทึก</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <Field label="ชื่องาน">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={inputClass} autoFocus={!readOnly} disabled={readOnly} />
        </Field>

        <Field label="รายละเอียด">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" maxLength={500} placeholder="อธิบายงานนี้เพิ่มเติม" className={textareaClass} disabled={readOnly} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium text-slate-700">ผู้รับผิดชอบ {assigneeIds.length > 0 && <span className="text-slate-400 font-normal">({assigneeIds.length} คน)</span>}</p>
            {!readOnly && assigneeIds.length > 0 && (
              <button type="button" onClick={() => setAssigneeIds([])} className="text-xs text-slate-500 hover:text-red-600">ล้างทั้งหมด</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const selected = assigneeIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleAssignee(m.id)}
                  className={`inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border text-sm transition-colors disabled:cursor-default ${
                    selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Avatar src={m.avatar} name={m.name} size="xs" />
                  {m.name}
                  {selected && <Icon name="check" className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
          {assigneeIds.length === 0 && <p className="text-xs text-slate-400 mt-1.5">ยังไม่มอบหมาย กดชื่อเพื่อเลือกได้หลายคน</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">

          <Field label="กำหนดส่ง">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} disabled={readOnly} />
          </Field>

          <Field label="ความสำคัญ">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass} disabled={readOnly}>
              <option value="">ไม่ระบุ</option>
              <option value="low">ต่ำ</option>
              <option value="medium">ปานกลาง</option>
              <option value="high">สูง</option>
            </select>
          </Field>

          <Field label="สถานะ">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} disabled={readOnly}>
              {columns.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Checklist</span>
            {checklist.length > 0 && <span className="text-xs text-slate-500">{doneCount}/{checklist.length} เสร็จแล้ว</span>}
          </div>
          {checklist.length > 0 && (
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: (doneCount / checklist.length) * 100 + '%' }} />
            </div>
          )}
          <div className="space-y-1">
            {checklist.map(item => (
              <div key={item.id} className="group flex items-center gap-2.5 px-2 h-9 rounded-lg hover:bg-slate-50">
                <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)} disabled={readOnly} className="w-4 h-4 accent-emerald-600" />
                <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.text}</span>
                {!readOnly && (
                  <span className="hidden group-hover:block">
                    <IconButton icon="x" title="ลบรายการ" size="sm" onClick={() => removeItem(item.id)} />
                  </span>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <form onSubmit={addItem} className="flex gap-2 mt-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} className={inputClass} placeholder="เพิ่มรายการย่อย แล้วกด Enter" />
              <Button type="submit" variant="secondary" icon="plus">เพิ่ม</Button>
            </form>
          )}
        </div>

        <ErrorBox message={error} />

        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-3">คอมเมนต์ ({comments.length})</p>
          <div className="space-y-3 mb-3">
            {comments.map(item => {
              const author = (users || []).find(u => u.id === item.authorId);
              return (
                <div key={item.id} className="flex gap-2.5">
                  <Avatar src={author ? author.avatar : null} name={author ? author.name : '?'} size="sm" />
                  <div className="flex-1 min-w-0 bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{author ? author.name : 'ผู้ใช้'}</span> · {timeAgo(item.createdAt)}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{item.text}</p>
                  </div>
                </div>
              );
            })}
            {comments.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีคอมเมนต์</p>}
          </div>
          {!readOnly && (
            <form onSubmit={sendComment} className="flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} className={inputClass} placeholder="เขียนคอมเมนต์..." />
              <Button type="submit" icon="send" disabled={sendingComment || !comment.trim()}>ส่ง</Button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
