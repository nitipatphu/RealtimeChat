import { useState } from 'react';
import Modal from '../ui/Modal';
import Button, { IconButton } from '../ui/Button';
import { Field, ErrorBox, Toggle, inputClass } from '../ui/Form';

export default function PollModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const changeOption = (index, value) => {
    setOptions(options.map((item, i) => (i === index ? value : item)));
  };

  const removeOption = (index) => {
    setOptions(options.filter((item, i) => i !== index));
  };

  const handleCreate = async () => {
    const filled = options.map(o => o.trim()).filter(o => o);
    if (!question.trim()) {
      setError('กรุณาพิมพ์คำถาม');
      return;
    }
    if (filled.length < 2) {
      setError('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ');
      return;
    }

    setSending(true);
    const ok = await onCreate({ question: question, options: filled, multiple: multiple });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title="สร้างโพล"
      description="ให้ทุกคนในห้องช่วยโหวต"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button icon="poll" onClick={handleCreate} disabled={sending}>{sending ? 'กำลังส่ง...' : 'ส่งโพล'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="คำถาม">
          <input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} className={inputClass} placeholder="เช่น ไปกินข้าวที่ไหนดี?" />
        </Field>

        <Field label={'ตัวเลือก (' + options.length + '/6)'}>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={option}
                  onChange={(e) => changeOption(index, e.target.value)}
                  maxLength={80}
                  className={inputClass}
                  placeholder={'ตัวเลือกที่ ' + (index + 1)}
                />
                {options.length > 2 && <IconButton icon="x" title="ลบตัวเลือก" onClick={() => removeOption(index)} />}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button type="button" onClick={() => setOptions([...options, ''])} className="mt-2 text-sm text-indigo-600 hover:underline">
              + เพิ่มตัวเลือก
            </button>
          )}
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">ให้เลือกได้หลายข้อ</span>
          <Toggle checked={multiple} onChange={setMultiple} />
        </div>

        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
