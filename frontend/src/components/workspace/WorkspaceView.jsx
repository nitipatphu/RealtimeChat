import { useState } from 'react';
import { apiSend } from '../../api';
import Sidebar from './Sidebar';
import ProjectChat from './ProjectChat';
import ProjectTaskBoard from './ProjectTaskBoard';
import DirectMessageView from './DirectMessageView';
import CalendarView from './CalendarView';
import ChannelChat from '../chat/ChannelChat';
import ProjectMembersModal from '../modals/ProjectMembersModal';
import Icon from '../ui/Icon';
import { IconButton } from '../ui/Button';
import Avatar from '../ui/Avatar';
import { SegmentedControl } from '../ui/Form';
import { canSeeProject, getMemberIds } from '../../utils/permissions';
import { getPresence, PRESENCE } from '../../utils/presence';
import { showError } from '../../utils/dialog';

function TopBar({ icon, title, subtitle, children, onSearch, onBack, pinsOpen, onTogglePins, muted, onToggleMute }) {
  return (
    <header className="h-14 sm:h-16 shrink-0 border-b border-slate-200 bg-white px-2 sm:px-5 flex items-center gap-2 sm:gap-4">
      <IconButton icon="arrowLeft" title="กลับไปที่รายการ" onClick={onBack} className="md:hidden" />
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
      {onToggleMute && <IconButton icon={muted ? 'bellSlash' : 'bell'} title={muted ? 'เปิดการแจ้งเตือนห้องนี้' : 'ปิดการแจ้งเตือนห้องนี้'} active={muted} onClick={onToggleMute} />}
      {onTogglePins && <IconButton icon="bookmark" title="ข้อความที่ปักหมุด" active={pinsOpen} onClick={onTogglePins} />}
      <IconButton icon="search" title="ค้นหา" onClick={onSearch} className="md:hidden" />
      <button
        type="button"
        onClick={onSearch}
        className="hidden md:flex items-center gap-2 h-9 w-56 px-3 rounded-lg bg-slate-100 text-sm text-slate-500 hover:bg-slate-200/70 transition-colors"
      >
        <Icon name="search" className="w-4 h-4" />
        ค้นหาในกลุ่ม...
      </button>
    </header>
  );
}

export default function WorkspaceView({
  currentGroup,
  currentUser,
  users,
  channels,
  setChannels,
  activeItem,
  onSelectItem,
  unread,
  mentionUnread,
  onlineUserIds,
  onGroupChange,
  onOpenGroupSettings,
  onLeaveGroup,
  onOpenSearch,
  onOpenProfile,
  readOnly,
  onExitInspect,
  mutedRooms,
  onToggleMute,
  showList,
  onShowListChange,
  projectTab,
  onProjectTabChange
}) {
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showPins, setShowPins] = useState(false);

  const selectFromSidebar = (type, id, channelId) => {
    onShowListChange(false);
    setShowPins(false);
    onSelectItem(type, id, channelId);
  };

  const muteKey = activeItem.type + ':' + activeItem.id;
  const barProps = {
    onSearch: onOpenSearch,
    onBack: () => onShowListChange(true),
    muted: (mutedRooms || []).includes(muteKey),
    onToggleMute: readOnly ? null : () => onToggleMute(muteKey)
  };

  const projects = currentGroup.projects || [];
  let channel = null;
  if (activeItem.type === 'channel') {
    channel = channels.find(c => c.id === activeItem.id) || channels[0] || null;
  }
  const project = activeItem.type === 'project' ? projects.find(p => p.id === activeItem.id) : null;
  const dmUser = activeItem.type === 'dm' ? (users || []).find(u => u.id === activeItem.id) : null;

  const updateProjects = (nextProjects) => {
    onGroupChange({ ...currentGroup, projects: nextProjects });
  };

  const handleProjectCreated = (newProject) => {
    if (projects.some(p => p.id === newProject.id)) return;
    updateProjects([...projects, newProject]);
  };

  const handleProjectDeleted = (projectId) => {
    updateProjects(projects.filter(p => p.id !== projectId));
    if (activeItem.type === 'project' && activeItem.id === projectId && channels.length > 0) {
      onSelectItem('channel', channels[0].id);
    }
  };

  const handleUpdateProject = (updatedProject) => {
    updateProjects(projects.map(p => (p.id === updatedProject.id ? updatedProject : p)));
  };

  const setProjectsAndSave = (updater) => {
    if (!project) return;
    const nextProjects = updater(projects);
    updateProjects(nextProjects);

    const changed = nextProjects.find(p => p.id === project.id);
    if (!changed) return;
    apiSend('PUT', '/groups/' + currentGroup.id + '/projects/' + changed.id + '/board', {
      columns: changed.columns,
      tasks: changed.tasks
    }).catch(err => showError('บันทึกบอร์ดไม่สำเร็จ: ' + err.message));
  };

  const chatProps = {
    currentUser: currentUser,
    users: users,
    onOpenProfile: onOpenProfile,
    readOnly: readOnly
  };

  let content = (
    <>
      <div className="md:hidden h-14 shrink-0 border-b border-slate-200 px-2 flex items-center">
        <IconButton icon="arrowLeft" title="กลับไปที่รายการ" onClick={() => onShowListChange(true)} />
      </div>
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">เลือก Channel, Project หรือข้อความส่วนตัวจากเมนูด้านซ้าย</div>
    </>
  );

  if (channel) {
    const parent = channel.parentId ? channels.find(c => c.id === channel.parentId) : null;
    content = (
      <>
        <TopBar
          icon={<Icon name="hash" className="w-5 h-5 text-slate-400" />}
          title={channel.name}
          subtitle={parent ? 'อยู่ใน #' + parent.name : getMemberIds(currentGroup).length + ' สมาชิก'}
          pinsOpen={showPins}
          onTogglePins={() => setShowPins(!showPins)}
          {...barProps}
        />
        <ChannelChat
          key={channel.id}
          channel={channel}
          currentGroup={currentGroup}
          setChannels={setChannels}
          showPins={showPins}
          onClosePins={() => setShowPins(false)}
          focusMessageId={activeItem.focusMessageId}
          {...chatProps}
        />
      </>
    );
  }

  if (project) {
    if (!readOnly && !canSeeProject(currentGroup, project, currentUser.id)) {
      content = <div className="flex-1 flex items-center justify-center text-sm text-slate-500">คุณไม่ได้เป็นสมาชิกของ Project นี้</div>;
    } else {
      const viewerIds = getMemberIds(currentGroup).filter(id => canSeeProject(currentGroup, project, id));
      const boardMembers = (users || []).filter(u => viewerIds.includes(u.id));
      const projectMembers = (users || []).filter(u => (project.members || []).includes(u.id));

      content = (
        <>
          <TopBar
            icon={
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Icon name="board" className="w-5 h-5" />
              </span>
            }
            title={project.name}
            subtitle={(project.tasks || []).length + ' งาน · ' + projectMembers.length + ' สมาชิก'}
            pinsOpen={showPins}
            onTogglePins={projectTab === 'chat' ? () => setShowPins(!showPins) : null}
            {...barProps}
          >
            <button type="button" onClick={() => { if (!readOnly) setShowMembersModal(true); }} className="hidden lg:flex -space-x-2 hover:opacity-80" title="จัดการสมาชิก Project">
              {projectMembers.slice(0, 4).map(user => (
                <span key={user.id} className="rounded-full ring-2 ring-white">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                </span>
              ))}
              {projectMembers.length > 4 && (
                <span className="w-7 h-7 rounded-full ring-2 ring-white bg-slate-100 text-xs font-medium text-slate-600 flex items-center justify-center">
                  +{projectMembers.length - 4}
                </span>
              )}
            </button>
            {project.archived && (
              <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                <Icon name="archive" className="w-3.5 h-3.5" />
                เก็บถาวร
              </span>
            )}
            <SegmentedControl
              value={projectTab}
              onChange={onProjectTabChange}
              options={[
                { value: 'chat', label: 'แชท' },
                { value: 'tasks', label: 'บอร์ดงาน' }
              ]}
            />
          </TopBar>

          {projectTab === 'chat' ? (
            <ProjectChat
              key={project.id + ':' + (activeItem.channelId || '')}
              project={project}
              group={currentGroup}
              initialChannelId={activeItem.channelId}
              focusMessageId={activeItem.focusMessageId}
              showPins={showPins}
              onClosePins={() => setShowPins(false)}
              {...chatProps}
            />
          ) : (
            <ProjectTaskBoard project={project} members={boardMembers} setProjects={setProjectsAndSave} readOnly={readOnly || project.archived} groupId={currentGroup.id} currentUser={currentUser} users={users} />
          )}

          {showMembersModal && (
            <ProjectMembersModal
              group={currentGroup}
              project={project}
              users={users}
              currentUser={currentUser}
              onClose={() => setShowMembersModal(false)}
              onUpdateProject={handleUpdateProject}
            />
          )}
        </>
      );
    }
  }

  if (activeItem.type === 'calendar') {
    const isDateKey = activeItem.id && activeItem.id !== 'today';
    content = (
      <>
        <TopBar
          icon={
            <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon name="calendar" className="w-5 h-5" />
            </span>
          }
          title="ปฏิทินกลุ่ม"
          subtitle="นัดหมายและกำหนดส่งงานของทุก Project ที่คุณเห็น"
          onSearch={onOpenSearch}
          onBack={() => onShowListChange(true)}
        />
        <CalendarView
          key={activeItem.id}
          group={currentGroup}
          currentUser={currentUser}
          users={users}
          readOnly={readOnly}
          initialDate={isDateKey ? activeItem.id : null}
          onOpenProject={(projectId) => {
            onProjectTabChange('tasks');
            selectFromSidebar('project', projectId);
          }}
        />
      </>
    );
  }

  if (dmUser) {
    const status = getPresence(dmUser, onlineUserIds);
    content = (
      <>
        <TopBar
          icon={<Avatar src={dmUser.avatar} name={dmUser.name} size="md" status={status} />}
          title={dmUser.name}
          subtitle={PRESENCE[status].label + (dmUser.title ? ' · ' + dmUser.title : '')}
          {...barProps}
        />
        <DirectMessageView key={dmUser.id} otherUser={dmUser} focusMessageId={activeItem.focusMessageId} {...chatProps} />
      </>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      <div className={(showList ? 'flex' : 'hidden') + ' md:flex w-full md:w-auto h-full'}>
      <Sidebar
        channels={channels}
        setChannels={setChannels}
        currentGroup={currentGroup}
        currentUser={currentUser}
        users={users}
        activeItem={activeItem}
        onSelect={selectFromSidebar}
        unread={unread}
        mentionUnread={mentionUnread}
        onlineUserIds={onlineUserIds}
        onProjectCreated={handleProjectCreated}
        onProjectDeleted={handleProjectDeleted}
        onOpenGroupSettings={onOpenGroupSettings}
        onLeaveGroup={onLeaveGroup}
        readOnly={readOnly}
        mutedRooms={mutedRooms}
        onOpenProfile={onOpenProfile}
      />
      </div>
      <main className={(showList ? 'hidden' : 'flex') + ' md:flex flex-1 flex-col min-w-0 bg-white'}>
        {readOnly && (
          <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-sm">
            <Icon name="eye" className="w-[18px] h-[18px] text-amber-600" />
            <span className="flex-1 text-amber-800">
              <span className="font-semibold">โหมดตรวจสอบ อ่านอย่างเดียว คุณไม่ได้เป็นสมาชิกกลุ่มนี้ </span> 
            </span>
            <button type="button" onClick={onExitInspect} className="font-medium text-amber-800 hover:underline">ออกจากโหมดตรวจสอบ</button>
          </div>
        )}
        {content}
      </main>
    </div>
  );
}
