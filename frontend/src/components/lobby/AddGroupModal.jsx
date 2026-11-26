import { useState } from 'react';
import { apiSend } from '../../api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { ErrorBox, inputClass } from '../ui/Form';
import CreateGroupModal from './CreateGroupModal';

function readCode(value) {
  const text = value.trim();
  const start = text.indexOf('invite=');
  if (start === -1) return text;

  let code = '';
  for (let i = start + 'invite='.length; i < text.length; i++) {
    if (text[i] === '&' || text[i] === '#' || text[i] === ' ') break;
    code = code + text[i];
  }
  return code;
}

export default function AddGroupModal({ currentUser, onClose, onJoined, onDiscover }) {
  const [step, setStep] = useState('choose');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async (e) => {
    e.preventDefault();
    const inviteCode = readCode(code);
    if (!inviteCode) return;
    setJoining(true);
    setError('');
    try {
      const data = await apiSend('POST', '/groups/join', { inviteCode: inviteCode });
      onJoined(data.group);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  if (step === 'create') {
    return <CreateGroupModal currentUser={currentUser} onClose={onClose} onCreated={onJoined} />;
  }

  if (step === 'join') {
    return (
      <Modal
        title="เข้าร่วมกลุ่ม"
        description="ใส่รหัสเชิญ หรือวางลิงก์เชิญที่ได้รับจากเพื่อน"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep('choose')}>ย้อนกลับ</Button>
            <Button onClick={join} disabled={joining || !code.trim()}>{joining ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}</Button>
          </>
        }
      >
        <form onSubmit={join} className="space-y-3">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="เช่น DEV"
            className={inputClass + ' font-mono'}
          />
          <ErrorBox message={error} />
        </form>
      </Modal>
    );
  }

  const options = [
    { id: 'create', icon: 'plus', title: 'สร้างกลุ่มใหม่', text: 'เริ่มกลุ่มของคุณเอง พร้อมแชท โปรเจกต์ และบอร์ดงาน', tone: 'bg-indigo-50 text-indigo-600' },
    { id: 'join', icon: 'key', title: 'เข้าร่วมด้วยรหัสหรือลิงก์เชิญ', text: 'ใช้กับกลุ่ม Private ที่มีคนส่งรหัสให้', tone: 'bg-emerald-50 text-emerald-600' },
    { id: 'discover', icon: 'globe', title: 'ค้นหากลุ่ม Public', text: 'ดูกลุ่มที่เปิดให้ทุกคนกดเข้าร่วมได้', tone: 'bg-amber-50 text-amber-600' }
  ];

  return (
    <Modal title="เพิ่มกลุ่ม" description="สร้างกลุ่มใหม่ หรือเข้าร่วมกลุ่มที่มีอยู่แล้ว" onClose={onClose}>
      <div className="space-y-2">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => (option.id === 'discover' ? onDiscover() : setStep(option.id))}
            className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:border-indigo-300 hover:bg-slate-50 transition-colors"
          >
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${option.tone}`}>
              <Icon name={option.icon} className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="block text-xs text-slate-500">{option.text}</span>
            </span>
            <Icon name="chevronRight" className="w-4 h-4 text-slate-400" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
