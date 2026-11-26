import { useState, useEffect, useRef } from 'react';
import { apiSend } from '../../api';
import CreateProjectModal from '../modals/CreateProjectModal';
import Modal from '../ui/Modal';
import Button, { IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import { GroupAvatar } from '../ui/Avatar';
import { Field, inputClass, ErrorBox } from '../ui/Form';
import { hasPermission, canSeeProject, getMemberIds } from '../../utils/permissions';
import MemberList from './MemberList';
import { copyText } from '../../utils/clipboard';

function UnreadBadge({ count, mentions }) {
  if (mentions) {
    return (
      <span title="มีคนกล่าวถึงคุณ" className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
        @{mentions > 9 ? '9+' : mentions}
      </span>
    );
  }
  if (!count) return null;
  return (
    <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SectionHeader({ title, onAdd, addTitle, open, onToggle, extraActions }) {
  return (
    <div className="flex items-center justify-between pl-2 pr-1 mb-1 group">
      <button type="button" onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 text-left">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} className="w-3 h-3 shrink-0" />
        <span className="truncate">{title}</span>
      </button>
      <div className="flex items-center">
        {extraActions && <div className="hidden group-hover:flex items-center">{extraActions}</div>}
        {onAdd && <IconButton icon="plus" title={addTitle} size="sm" onClick={onAdd} />}
      </div>
    </div>
  );
}

function NavItem({ active, unread, onClick, children, actions, indent }) {
  let colorClass = 'text-slate-600 hover:bg-slate-100';
  if (unread) colorClass = 'text-slate-900 hover:bg-slate-100';
  if (active) colorClass = 'bg-indigo-50 text-indigo-700';

  return (
    <div className={'group flex items-center rounded-lg h-9 ' + (indent ? 'ml-4 ' : '') + colorClass}>
      <button type="button" onClick={onClick} className={`flex-1 min-w-0 h-full flex items-center gap-2 px-2.5 text-sm text-left ${unread || active ? 'font-semibold' : 'font-medium'}`}>
        {children}
      </button>
      {actions && <div className="hidden group-hover:flex items-center pr-1">{actions}</div>}
    </div>
  );
}

function GroupMenu({ group, currentUser, onOpenGroupSettings, onLeaveGroup, onClose, readOnly, onCreateCategory }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const copyCode = () => {
    copyText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const items = [
    { icon: 'settings', label: 'ตั้งค่ากลุ่ม', onClick: () => onOpenGroupSettings('general') },
    { icon: 'users', label: 'สมาชิกและชื่อเล่น', onClick: () => onOpenGroupSettings('members') }
  ];
  if (hasPermission(group, currentUser.id, 'manage_roles')) {
    items.push({ icon: 'tag', label: 'จัดการ Role', onClick: () => onOpenGroupSettings('roles') });
  }
  items.push({ icon: 'mail', label: 'ลิงก์เชิญ', onClick: () => onOpenGroupSettings('invites') });
  if (!readOnly && hasPermission(group, currentUser.id, 'manage_channels')) {
    items.push({ icon: 'list', label: 'สร้างหมวดหมู่ Channel', onClick: onCreateCategory });
  }
  if (readOnly || hasPermission(group, currentUser.id, 'view_logs')) {
    items.push({ icon: 'clock', label: 'Log ของกลุ่ม', onClick: () => onOpenGroupSettings('logs') });
  }

  return (
    <div ref={ref} className="absolute left-3 right-3 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5">
      <button type="button" onClick={copyCode} className="w-full flex items-center justify-between gap-2 px-3 h-10 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
        <span className="flex items-center gap-2.5">
          <Icon name="copy" className="w-4 h-4 text-slate-500" />
          รหัสเชิญ <span className="font-mono font-semibold tracking-wider text-slate-900">{group.inviteCode}</span>
        </span>
        <span className="text-xs text-indigo-600">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
      </button>
      <div className="border-t border-slate-100 my-1" />
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          onClick={() => { item.onClick(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
        >
          <Icon name={item.icon} className="w-4 h-4 text-slate-500" />
          {item.label}
        </button>
      ))}
      {!readOnly && group.ownerId !== currentUser.id && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <button
            type="button"
            onClick={() => { onLeaveGroup(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 h-10 rounded-lg hover:bg-red-50 text-sm text-red-600"
          >
            <Icon name="logout" className="w-4 h-4" />
            ออกจากกลุ่ม
          </button>
        </>
      )}
    </div>
  );
}

export default function Sidebar({
  channels,
  setChannels,
  currentGroup,
  currentUser,
  users,
  activeItem,
  onSelect,
  unread,
  mentionUnread,
  onlineUserIds,
  onProjectCreated,
  onProjectDeleted,
  onOpenGroupSettings,
  onLeaveGroup,
  readOnly,
  mutedRooms,
  onOpenProfile
}) {
  const [expanded, setExpanded] = useState({});
  const [sections, setSections] = useState({ channels: true, projects: true, archived: false });
  const [channelCategory, setChannelCategory] = useState('');
  const [categoryModal, setCategoryModal] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [channelModal, setChannelModal] = useState(null);
  const [channelName, setChannelName] = useState('');
  const [channelRoles, setChannelRoles] = useState([]);
  const [channelError, setChannelError] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);

  const canManageChannels = hasPermission(currentGroup, currentUser.id, 'manage_channels');
  const canCreateProject = hasPermission(currentGroup, currentUser.id, 'create_projects') || hasPermission(currentGroup, currentUser.id, 'manage_projects');
  const canManageProjects = hasPermission(currentGroup, currentUser.id, 'manage_projects');

  const visibleProjects = (currentGroup.projects || []).filter(p => readOnly || canSeeProject(currentGroup, p, currentUser.id));
  const projects = visibleProjects.filter(p => !p.archived);
  const archivedProjects = visibleProjects.filter(p => p.archived);
  const categories = currentGroup.categories || [];
  const categoryIds = categories.map(c => c.id);
  const isSectionOpen = (key) => sections[key] !== false;
  const looseChannels = channels.filter(c => !c.parentId && !categoryIds.includes(c.categoryId));
  const memberIds = getMemberIds(currentGroup);

  const toggleSection = (key) => {
    setSections({ ...sections, [key]: !sections[key] });
  };

  const openChannelModal = (mode, channel, parentId, categoryId) => {
    setChannelModal({ mode: mode, channel: channel, parentId: parentId || null });
    setChannelCategory(channel ? channel.categoryId || '' : categoryId || '');
    setChannelName(channel ? channel.name : '');
    setChannelRoles(channel ? channel.allowedRoleIds || [] : []);
    setChannelError('');
  };

  const saveChannel = async () => {
    if (!channelName.trim()) {
      setChannelError('กรุณาตั้งชื่อ Channel');
      return;
    }
    try {
      if (channelModal.mode === 'rename') {
        const data = await apiSend('PUT', '/channels/' + channelModal.channel.id, { name: channelName, allowedRoleIds: channelRoles, categoryId: channelCategory || null });
        setChannels(prev => prev.map(c => (c.id === data.id ? { ...c, name: data.name, allowedRoleIds: data.allowedRoleIds, categoryId: data.categoryId } : c)));
      } else {
        const data = await apiSend('POST', '/channels', {
          name: channelName,
          parentId: channelModal.parentId,
          groupId: currentGroup.id,
          allowedRoleIds: channelRoles,
          categoryId: channelCategory || null
        });
        setChannels(prev => (prev.some(c => c.id === data.id) ? prev : [...prev, data]));
        if (channelModal.parentId) setExpanded(prev => ({ ...prev, [channelModal.parentId]: true }));
        onSelect('channel', data.id);
      }
      setChannelModal(null);
    } catch (err) {
      setChannelError(err.message);
    }
  };

  const deleteChannel = async (channel) => {
    if (!window.confirm('ลบ #' + channel.name + '? ข้อความทั้งหมดจะหายไป')) return;
    try {
      await apiSend('DELETE', '/channels/' + channel.id);
      setChannels(prev => prev.filter(c => c.id !== channel.id && c.parentId !== channel.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const openCategoryModal = (category) => {
    setCategoryModal({ category: category });
    setCategoryName(category ? category.name : '');
    setCategoryError('');
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      setCategoryError('กรุณาตั้งชื่อหมวดหมู่');
      return;
    }
    try {
      if (categoryModal.category) {
        await apiSend('PUT', '/groups/' + currentGroup.id + '/categories/' + categoryModal.category.id, { name: categoryName });
      } else {
        await apiSend('POST', '/groups/' + currentGroup.id + '/categories', { name: categoryName });
      }
      setCategoryModal(null);
    } catch (err) {
      setCategoryError(err.message);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm('ลบหมวดหมู่ ' + category.name + '? Channel ข้างในจะไม่ถูกลบ แต่จะย้ายไปอยู่นอกหมวดหมู่')) return;
    try {
      await apiSend('DELETE', '/groups/' + currentGroup.id + '/categories/' + category.id);
      setChannels(prev => prev.map(c => (c.categoryId === category.id ? { ...c, categoryId: null } : c)));
    } catch (err) {
      alert(err.message);
    }
  };

  const setArchived = async (project, archived) => {
    const question = archived
      ? 'เก็บ Project ' + project.name + ' ถาวร? แชทและบอร์ดจะยังอยู่ ดูย้อนหลังได้ แต่แก้ไขหรือส่งข้อความไม่ได้'
      : 'นำ Project ' + project.name + ' ออกจากที่เก็บ? จะกลับมาใช้งานได้ตามปกติ';
    if (!window.confirm(question)) return;
    try {
      await apiSend('PUT', '/groups/' + currentGroup.id + '/projects/' + project.id + '/archive', { archived: archived });
    } catch (err) {
      alert(err.message);
    }
  };

  const renderProject = (project) => {
    const key = 'project:' + project.id;
    const isActive = activeItem.type === 'project' && activeItem.id === project.id;
    const actions = canManageProjects ? (
      <>
        <IconButton
          icon={project.archived ? 'refresh' : 'archive'}
          title={project.archived ? 'นำออกจากที่เก็บถาวร' : 'เก็บถาวร'}
          size="sm"
          onClick={() => setArchived(project, !project.archived)}
        />
        <IconButton icon="trash" title="ลบ Project" size="sm" danger onClick={() => deleteProject(project)} />
      </>
    ) : null;

    return (
      <NavItem key={project.id} active={isActive} unread={!project.archived && unread[key]} onClick={() => onSelect('project', project.id)} actions={actions}>
        <Icon name={project.archived ? 'archive' : 'board'} className="w-4 h-4 opacity-60 shrink-0" />
        <span className={`truncate ${isMuted(key) || project.archived ? 'opacity-50' : ''}`}>{project.name}</span>
        {isMuted(key) && !project.archived && <Icon name="bellSlash" className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        {!project.archived && <UnreadBadge count={isMuted(key) ? 0 : unread[key]} mentions={mentionUnread[key]} />}
      </NavItem>
    );
  };

  const deleteProject = async (project) => {
    if (!window.confirm('ลบ Project ' + project.name + '? แชทและบอร์ดงานจะหายไปทั้งหมด')) return;
    try {
      await apiSend('DELETE', '/groups/' + currentGroup.id + '/projects/' + project.id);
      onProjectDeleted(project.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const isMuted = (key) => (mutedRooms || []).includes(key);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  let todayCount = (currentGroup.events || []).filter(e => e.date === todayKey).length;
  projects.forEach(project => {
    const columns = project.columns || [];
    const lastColumn = columns[columns.length - 1];
    (project.tasks || []).forEach(task => {
      if (task.dueDate === todayKey && !(lastColumn && task.status === lastColumn.id)) todayCount = todayCount + 1;
    });
  });

  let channelModalTitle = 'สร้าง Channel';
  if (channelModal && channelModal.parentId) channelModalTitle = 'สร้าง Sub-channel';
  if (channelModal && channelModal.mode === 'rename') channelModalTitle = 'แก้ไข Channel';

  const toggleChannelRole = (roleId) => {
    if (channelRoles.includes(roleId)) {
      setChannelRoles(channelRoles.filter(id => id !== roleId));
    } else {
      setChannelRoles([...channelRoles, roleId]);
    }
  };

  const renderChannel = (channel, isSub) => {
    const subs = channels.filter(c => c.parentId === channel.id);
    const key = 'channel:' + channel.id;
    const isActive = activeItem.type === 'channel' && activeItem.id === channel.id;
    const isOpen = expanded[channel.id];
    let hiddenUnread = 0;
    let hiddenMentions = 0;
    if (!isOpen) {
      subs.forEach(sub => {
        const subKey = 'channel:' + sub.id;
        if (!isMuted(subKey)) hiddenUnread = hiddenUnread + (unread[subKey] || 0);
        hiddenMentions = hiddenMentions + (mentionUnread[subKey] || 0);
      });
    }

    const actions = canManageChannels ? (
      <>
        {!isSub && <IconButton icon="plus" title="สร้าง Sub-channel" size="sm" onClick={() => openChannelModal('create', null, channel.id, null)} />}
        <IconButton icon="pencil" title="แก้ไข Channel" size="sm" onClick={() => openChannelModal('rename', channel)} />
        <IconButton icon="trash" title="ลบ Channel" size="sm" danger onClick={() => deleteChannel(channel)} />
      </>
    ) : null;

    return (
      <div key={channel.id}>
        <NavItem active={isActive} unread={unread[key] || hiddenUnread} onClick={() => onSelect('channel', channel.id)} actions={actions} indent={isSub}>
          {subs.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setExpanded({ ...expanded, [channel.id]: !isOpen }); }}
              className="text-slate-400 hover:text-slate-700 -ml-1"
            >
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} className="w-3.5 h-3.5" />
            </span>
          ) : null}
          <Icon name={(channel.allowedRoleIds || []).length > 0 ? 'lock' : 'hash'} className="w-4 h-4 opacity-60 shrink-0" />
          <span className={`truncate ${isMuted(key) ? 'opacity-50' : ''}`}>{channel.name}</span>
          {isMuted(key) && <Icon name="bellSlash" className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
          <UnreadBadge count={(isMuted(key) ? 0 : unread[key] || 0) + hiddenUnread} mentions={(mentionUnread[key] || 0) + hiddenMentions} />
        </NavItem>
        {subs.length > 0 && isOpen && (
          <div className="border-l border-slate-200 ml-4">{subs.map(sub => renderChannel(sub, true))}</div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full select-none">
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="w-full h-16 flex items-center gap-3 px-4 border-b border-slate-200 hover:bg-slate-50 transition-colors text-left"
        >
          <GroupAvatar group={currentGroup} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{currentGroup.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Icon name={currentGroup.visibility === 'public' ? 'globe' : 'lock'} className="w-3 h-3" />
              {currentGroup.visibility === 'public' ? 'Public' : 'Private'} · {memberIds.length} สมาชิก
            </p>
          </div>
          <Icon name="chevronDown" className="w-4 h-4 text-slate-400" />
        </button>
        {showMenu && (
          <GroupMenu
            group={currentGroup}
            currentUser={currentUser}
            onOpenGroupSettings={onOpenGroupSettings}
            onLeaveGroup={onLeaveGroup}
            onClose={() => setShowMenu(false)}
            readOnly={readOnly}
            onCreateCategory={() => openCategoryModal(null)}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        <NavItem active={activeItem.type === 'calendar'} onClick={() => onSelect('calendar', 'today')}>
          <Icon name="calendar" className="w-4 h-4 opacity-60 shrink-0" />
          <span className="truncate">ปฏิทินกลุ่ม</span>
          {todayCount > 0 && (
            <span title="นัดและงานวันนี้" className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
              {todayCount}
            </span>
          )}
        </NavItem>

        {(canManageChannels || looseChannels.length > 0) && (
        <div>
          <SectionHeader
            title="Channels"
            open={sections.channels}
            onToggle={() => toggleSection('channels')}
            onAdd={canManageChannels ? () => openChannelModal('create', null, null, null) : null}
            addTitle="สร้าง Channel"
          />
          {sections.channels && (
            <div className="space-y-0.5">
              {looseChannels.map(c => renderChannel(c, false))}
            </div>
          )}
        </div>
        )}

        {categories.map(category => {
          const list = channels.filter(c => !c.parentId && c.categoryId === category.id);
          const open = isSectionOpen(category.id);
          return (
            <div key={category.id}>
              <SectionHeader
                title={category.name}
                open={open}
                onToggle={() => setSections({ ...sections, [category.id]: !open })}
                onAdd={canManageChannels ? () => openChannelModal('create', null, null, category.id) : null}
                addTitle={'สร้าง Channel ใน ' + category.name}
                extraActions={canManageChannels ? (
                  <>
                    <IconButton icon="pencil" title="เปลี่ยนชื่อหมวดหมู่" size="sm" onClick={() => openCategoryModal(category)} />
                    <IconButton icon="trash" title="ลบหมวดหมู่" size="sm" danger onClick={() => deleteCategory(category)} />
                  </>
                ) : null}
              />
              {open && (
                <div className="space-y-0.5">
                  {list.map(c => renderChannel(c, false))}
                  {list.length === 0 && <p className="px-2.5 py-1 text-xs text-slate-400">ยังไม่มี Channel ในหมวดนี้</p>}
                </div>
              )}
            </div>
          );
        })}

        <div>
          <SectionHeader
            title="Projects"
            open={sections.projects}
            onToggle={() => toggleSection('projects')}
            onAdd={canCreateProject ? () => setShowCreateProject(true) : null}
            addTitle="สร้าง Project"
          />
          {sections.projects && (
            <div className="space-y-0.5">
              {projects.map(project => renderProject(project))}
              {projects.length === 0 && <p className="px-2.5 py-1 text-sm text-slate-400">ยังไม่มี Project</p>}
            </div>
          )}
        </div>

        {archivedProjects.length > 0 && (
          <div>
            <SectionHeader
              title={'เก็บถาวร — ' + archivedProjects.length}
              open={sections.archived}
              onToggle={() => toggleSection('archived')}
            />
            {sections.archived && <div className="space-y-0.5">{archivedProjects.map(project => renderProject(project))}</div>}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100">
          <MemberList
            group={currentGroup}
            users={users}
            onlineUserIds={onlineUserIds}
            unread={unread}
            mutedRooms={mutedRooms}
            onOpenProfile={onOpenProfile}
          />
        </div>
      </div>

      {channelModal && (
        <Modal
          title={channelModalTitle}
          onClose={() => setChannelModal(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setChannelModal(null)}>ยกเลิก</Button>
              <Button onClick={saveChannel}>{channelModal.mode === 'rename' ? 'บันทึก' : 'สร้าง'}</Button>
            </>
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); saveChannel(); }} className="space-y-3">
            <Field label="ชื่อ Channel" hint="ช่องว่างจะถูกเปลี่ยนเป็นขีด เช่น my-team">
              <div className="relative">
                <Icon name="hash" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input autoFocus value={channelName} onChange={(e) => setChannelName(e.target.value)} className={inputClass + ' pl-9'} placeholder="new-channel" />
              </div>
            </Field>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1.5">ใครเห็นห้องนี้</p>
              <div className="space-y-1.5">
                <label className={`flex items-center gap-3 px-3 h-10 rounded-lg border cursor-pointer ${channelRoles.length === 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200'}`}>
                  <input type="radio" checked={channelRoles.length === 0} onChange={() => setChannelRoles([])} className="accent-indigo-600" />
                  <Icon name="hash" className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-800">ทุกคนในกลุ่ม</span>
                </label>
                <div className={`rounded-lg border px-3 py-2 ${channelRoles.length > 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200'}`}>
                  <p className="flex items-center gap-2 text-sm text-slate-800 mb-1.5">
                    <Icon name="lock" className="w-4 h-4 text-slate-500" />
                    ส่วนตัว: เฉพาะ Role ที่เลือก
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentGroup.roles || []).map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleChannelRole(role.id)}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium ${
                          channelRoles.includes(role.id) ? 'border-indigo-500 bg-white text-indigo-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                        {role.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">เจ้าของกลุ่มและคนที่มีสิทธิ์จัดการ Channel เห็นทุกห้องเสมอ</p>
                </div>
              </div>
            </div>
            {!channelModal.parentId && !(channelModal.channel && channelModal.channel.parentId) && (
              <Field label="หมวดหมู่">
                <select value={channelCategory} onChange={(e) => setChannelCategory(e.target.value)} className={inputClass}>
                  <option value="">ไม่มีหมวดหมู่</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <ErrorBox message={channelError} />
          </form>
        </Modal>
      )}

      {categoryModal && (
        <Modal
          title={categoryModal.category ? 'เปลี่ยนชื่อหมวดหมู่' : 'สร้างหมวดหมู่ Channel'}
          description={categoryModal.category ? '' : 'ใช้จัดกลุ่ม Channel เช่น งาน พูดคุย หรือประกาศ'}
          onClose={() => setCategoryModal(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCategoryModal(null)}>ยกเลิก</Button>
              <Button onClick={saveCategory}>{categoryModal.category ? 'บันทึก' : 'สร้าง'}</Button>
            </>
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); saveCategory(); }} className="space-y-3">
            <Field label="ชื่อหมวดหมู่">
              <input autoFocus value={categoryName} onChange={(e) => setCategoryName(e.target.value)} maxLength={40} className={inputClass} placeholder="เช่น งาน" />
            </Field>
            <ErrorBox message={categoryError} />
          </form>
        </Modal>
      )}

      {showCreateProject && (
        <CreateProjectModal
          group={currentGroup}
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreateProject(false)}
          onCreate={(project) => {
            onProjectCreated(project);
            onSelect('project', project.id);
          }}
        />
      )}
    </aside>
  );
}
