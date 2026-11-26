import { useState, useEffect } from 'react';
import { closeTopPanel } from './utils/backButton';
import socket from './socket';
import { apiGet, apiSend, saveToken, getToken } from './api';
import { setSettingsFromServer, applySettings, loadSettings } from './settings';
import { getVipTier, setTierSettings } from './utils/vip';
import { isGroupMember, isStaffUser, isAdminUser } from './utils/permissions';
import { getPresence } from './utils/presence';
import useUserEvents from './hooks/useUserEvents';
import useChannelEvents from './hooks/useChannelEvents';
import useGroupEvents from './hooks/useGroupEvents';
import useMessageAlerts from './hooks/useMessageAlerts';
import useNotifications from './hooks/useNotifications';
import LoginView from './components/auth/LoginView';
import AppRail from './components/layout/AppRail';
import LobbyView from './components/lobby/LobbyView';
import WorkspaceView from './components/workspace/WorkspaceView';
import GroupSettingsView from './components/groupSettings/GroupSettingsView';
import UserSettingsView from './components/settings/UserSettingsView';
import OverviewView from './components/overview/OverviewView';
import AdminView from './components/admin/AdminView';
import StaffView from './components/staff/StaffView';
import MessagesView from './components/messages/MessagesView';
import ClipboardView from './components/clipboard/ClipboardView';
import AddGroupModal from './components/lobby/AddGroupModal';
import SearchModal from './components/modals/SearchModal';
import UserProfileModal from './components/modals/UserProfileModal';
import Icon from './components/ui/Icon';
import BlockedContext from './blockedContext';

function getSavedUser() {
  const saved = localStorage.getItem('user');
  if (!saved || !getToken()) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

const PAGE_TITLES = {
  lobby: 'หน้าหลัก',
  overview: 'ภาพรวมของฉัน',
  clipboard: 'คลิปบอร์ดของฉัน',
  settings: 'ตั้งค่าของฉัน',
  messages: 'ข้อความ',
  admin: 'Dashboard'
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(getSavedUser());
  const [view, setView] = useState('lobby');
  const [settingsTab, setSettingsTab] = useState('profile');
  const [groupSettingsTab, setGroupSettingsTab] = useState('general');
  const [adminTab, setAdminTab] = useState('stats');
  const [staffTab, setStaffTab] = useState('users');
  const [inspecting, setInspecting] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messagesTarget, setMessagesTarget] = useState(null);
  const [workspaceShowList, setWorkspaceShowList] = useState(true);
  const [projectTab, setProjectTab] = useState('chat');

  const [users, setUsers] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeItem, setActiveItem] = useState({ type: 'channel', id: null });

  const [unread, setUnread] = useState({});
  const [mentionUnread, setMentionUnread] = useState({});
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const [toasts, setToasts] = useState([]);
  const [savedToast, setSavedToast] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [blockedIds, setBlockedIds] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [lobbyTab, setLobbyTab] = useState('mine');

  const inbox = useNotifications(currentUser);

  const fetchMyGroups = async () => {
    if (!currentUser) return [];
    try {
      const data = await apiGet('/groups');
      setMyGroups(data);
      return data;
    } catch (error) {
      console.error('โหลดกลุ่มไม่สำเร็จ', error);
      return [];
    }
  };

  const fetchUnread = async (groupId) => {
    try {
      const data = await apiGet('/users/' + currentUser.id + '/unread?groupId=' + groupId);
      setUnread(data.unread);
      setMentionUnread(data.mentions);
    } catch (error) {
      console.error('โหลดข้อความที่ยังไม่อ่านไม่สำเร็จ', error);
    }
  };

  const showSaved = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const showToast = (title, body, target) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id: id, title: title, body: body, target: target }].slice(-4));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const markRead = (key) => {
    if (!currentUser) return;

    setUnread(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setMentionUnread(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    apiSend('POST', '/users/' + currentUser.id + '/read', { key: key }).catch(() => {});
  };

  const selectConversation = (target) => {
    setMessagesTarget(target);
    setView('messages');
    if (target) {
      markRead(target.type + ':' + target.id);
    }
  };

  const isActiveConversation = (type, id) => {
    return view === 'messages' && messagesTarget !== null && messagesTarget.type === type && messagesTarget.id === id;
  };

  const handleToggleMute = async (key) => {
    const muted = (currentUser.mutedRooms || []).includes(key);
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id + '/mute', { key: key, muted: !muted });
      handleUserUpdated(data.user);
    } catch (err) {
      alert(err.message);
    }
  };

  const refreshChannels = (groupId) => {
    apiGet('/channels?groupId=' + groupId)
      .then(list => {
        setChannels(prev => list.map(channel => {
          const old = prev.find(c => c.id === channel.id);
          return old ? { ...old, ...channel } : channel;
        }));
      })
      .catch(err => console.error(err));
  };

  const handleSelectItem = (type, id, channelId, tab, focusMessageId) => {
    setWorkspaceShowList(false);
    if (tab) setProjectTab(tab);
    setActiveItem({ type: type, id: id, channelId: channelId || null, focusMessageId: focusMessageId || null });
    setView('workspace');
    if (!inspecting && type !== 'calendar') {
      markRead(type + ':' + id);
    }
  };

  const handleToggleBlock = async (userId, blocked) => {
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id + '/blocks', { targetId: userId, blocked: blocked });
      setBlockedIds(data.blockedIds);
      if (blocked) {
        showToast('บล็อกผู้ใช้แล้ว', 'ข้อความของผู้ใช้นี้จะถูกซ่อน และเขาส่ง DM หาคุณไม่ได้', null);
      } else {
        showToast('ปลดบล็อกแล้ว', 'คุณจะเห็นข้อความของผู้ใช้นี้ตามปกติ', null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openGroup = async (group, inspectMode, startItem) => {
    const isInspect = inspectMode === true;
    setInspecting(isInspect);
    if (isInspect) {
      localStorage.removeItem('groupId');
    } else {
      localStorage.setItem('groupId', group.id);
    }
    setUnread({});
    setMentionUnread({});
    setCurrentGroup(group);
    setView('workspace');
    setWorkspaceShowList(!startItem);

    try {
      const channelData = await apiGet('/channels?groupId=' + group.id);
      setChannels(channelData);

      let firstItem = startItem;
      if (!firstItem && channelData.length > 0) {
        firstItem = { type: 'channel', id: channelData[0].id };
      }
      if (firstItem) {
        if (firstItem.tab) setProjectTab(firstItem.tab);
        setActiveItem({ type: firstItem.type, id: firstItem.id, channelId: firstItem.channelId || null });
      }

      if (isInspect) return;
      if (firstItem) {
        try {
          await apiSend('POST', '/users/' + currentUser.id + '/read', { key: firstItem.type + ':' + firstItem.id });
        } catch (error) {
          console.error(error);
        }
      }
      fetchUnread(group.id);
    } catch (error) {
      setChannels([]);
      alert(error.message);
    }
  };

  const closeCurrentGroup = () => {
    setInspecting(false);
    localStorage.removeItem('groupId');
    setCurrentGroup(null);
    setChannels([]);
    setView('lobby');
    fetchMyGroups();
  };

  const inspectGroup = async (groupId) => {
    try {
      const group = await apiGet('/groups/' + groupId + '/inspect');
      openGroup(group, !isGroupMember(group, currentUser.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const exitInspect = () => {
    closeCurrentGroup();
    setAdminTab('groups');
    setView('admin');
  };

  const handleLogin = (userData, token) => {
    saveToken(token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.settings) {
      setSettingsFromServer(userData.settings);
    }
    setCurrentUser(userData);
    setView('lobby');
  };

  const handleLogout = () => {
    apiSend('POST', '/users/logout', {}).catch(() => {});
    saveToken('');
    socket.emit('logout');
    localStorage.removeItem('user');
    localStorage.removeItem('groupId');
    setUnread({});
    setMentionUnread({});
    setCurrentGroup(null);
    setMyGroups([]);
    setChannels([]);
    setMobileNavOpen(false);
    setCurrentUser(null);
  };

  const handleUserUpdated = (updated) => {
    localStorage.setItem('user', JSON.stringify(updated));
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
  };

  const handleSetPresence = async (presence) => {
    try {
      const data = await apiSend('PUT', '/users/' + currentUser.id + '/presence', { presence: presence });
      handleUserUpdated(data.user);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGroupChange = (updatedGroup) => {
    setCurrentGroup(updatedGroup);
    setMyGroups(prev => prev.map(g => (g.id === updatedGroup.id ? updatedGroup : g)));
  };

  const navigate = (nextView) => {
    setMobileNavOpen(false);
    if (nextView === 'lobby') setLobbyTab('mine');
    if (nextView === 'workspace' && !currentGroup) {
      setView('lobby');
      return;
    }
    setView(nextView);
  };

  const selectGroupFromRail = (group) => {
    setMobileNavOpen(false);
    if (currentGroup && currentGroup.id === group.id) {
      setView('workspace');
    } else {
      openGroup(group);
    }
  };

  const openGroupSettings = (tab) => {
    setGroupSettingsTab(tab || 'general');
    setView('groupSettings');
  };

  const handleLeaveGroupFromMenu = async () => {
    if (!currentGroup) return;
    if (!window.confirm('ออกจากกลุ่ม ' + currentGroup.name + '?')) return;
    try {
      await apiSend('POST', '/groups/' + currentGroup.id + '/leave', {});
      closeCurrentGroup();
    } catch (err) {
      alert(err.message);
    }
  };

  const goToTarget = (target) => {
    setMobileNavOpen(false);
    if (!target) return;

    if (target.type === 'overview') {
      setView('overview');
      return;
    }
    if (target.type === 'settings') {
      setSettingsTab(target.id || 'profile');
      setView('settings');
      return;
    }
    if (target.type === 'dm' || target.type === 'gdm') {
      selectConversation({ type: target.type, id: target.id });
      return;
    }

    const sameGroup = currentGroup && (!target.groupId || target.groupId === currentGroup.id);
    if (target.type === 'group' || !sameGroup) {
      const group = myGroups.find(g => g.id === target.groupId);
      if (!group) return;
      const startItem = target.type === 'group' ? null : { type: target.type, id: target.id, channelId: target.channelId, tab: target.tab };
      openGroup(group, false, startItem);
      return;
    }

    handleSelectItem(target.type, target.id, target.channelId, target.tab);
  };

  const goBack = () => {
    if (closeTopPanel()) return true;
    if (mobileNavOpen) {
      setMobileNavOpen(false);
      return true;
    }
    const isMobile = window.innerWidth < 768;
    if (view === 'workspace' && isMobile && !workspaceShowList) {
      setWorkspaceShowList(true);
      return true;
    }
    if (view === 'messages' && messagesTarget) {
      setMessagesTarget(null);
      return true;
    }
    if (view === 'groupSettings' && currentGroup) {
      setView('workspace');
      return true;
    }
    if (view !== 'lobby') {
      setView('lobby');
      return true;
    }
    return false;
  };

  const currentUserId = currentUser ? currentUser.id : null;

  useEffect(() => {
    if (!currentUserId) return;
    window.history.pushState({ app: true }, '');
  }, [currentUserId]);

  useEffect(() => {
    const handleBackButton = () => {
      const handled = goBack();
      if (handled) {
        window.history.pushState({ app: true }, '');
      } else {
        window.history.back();
      }
    };
    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  });

  const handleOpenNotification = (notification) => {
    inbox.markRead(notification.id);
    goToTarget(notification.target);
  };

  const handleSuspended = (data) => {
    alert('บัญชีของคุณถูกระงับหรือถูกลบโดยผู้ดูแลระบบ' + (data && data.reason ? '\nเหตุผล: ' + data.reason : ''));
    handleLogout();
  };

  useEffect(() => {
    if (!currentUser) return;

    apiGet('/users')
      .then(data => setUsers(data))
      .catch(err => console.error(err));

    apiGet('/users/' + currentUser.id + '/blocks')
      .then(data => setBlockedIds(data.blockedIds))
      .catch(() => setBlockedIds([]));

    const inviteCode = new URLSearchParams(window.location.search).get('invite');
    if (inviteCode) {
      window.history.replaceState(null, '', window.location.pathname);
      apiSend('POST', '/groups/join', { inviteCode: inviteCode })
        .then(data => {
          fetchMyGroups();
          openGroup(data.group);
        })
        .catch(err => alert('เข้าร่วมกลุ่มไม่สำเร็จ: ' + err.message));
    }

    apiGet('/groups')
      .then(groups => {
        setMyGroups(groups);
        if (inviteCode) return;
        const savedGroupId = localStorage.getItem('groupId');
        const savedGroup = groups.find(g => g.id === savedGroupId);
        if (savedGroup) {
          openGroup(savedGroup);
        } else {
          localStorage.removeItem('groupId');
          fetchUnread('');
        }
      })
      .catch(err => console.error(err));
  }, [currentUserId]);

  useUserEvents({
    currentUser: currentUser,
    setCurrentUser: setCurrentUser,
    setUsers: setUsers,
    setOnlineUserIds: setOnlineUserIds,
    onSuspended: handleSuspended
  });

  useChannelEvents(setChannels, currentGroup, currentUser, inspecting);

  const [tierVersion, setTierVersion] = useState(0);

  useEffect(() => {
    apiGet('/system-settings')
      .then(data => {
        setTierSettings(data.tiers);
        setTierVersion(v => v + 1);
      })
      .catch(() => {});

    const handleSystemSettings = (data) => {
      setTierSettings(data.tiers);
      setTierVersion(v => v + 1);
    };
    socket.on('system-settings:updated', handleSystemSettings);
    return () => socket.off('system-settings:updated', handleSystemSettings);
  }, []);

  const myVipTier = getVipTier(currentUser);
  const myCustomTheme = currentUser && currentUser.customTheme ? JSON.stringify(currentUser.customTheme) : '';
  useEffect(() => {
    applySettings(loadSettings());
  }, [myVipTier, myCustomTheme, tierVersion]);

  useEffect(() => {
    const handleBlocks = (data) => setBlockedIds(data.blockedIds);
    socket.on('blocks:changed', handleBlocks);
    return () => socket.off('blocks:changed', handleBlocks);
  }, []);

  useGroupEvents({
    currentUser: currentUser,
    currentGroup: currentGroup,
    inspecting: inspecting,
    activeItem: activeItem,
    channels: channels,
    setMyGroups: setMyGroups,
    setCurrentGroup: setCurrentGroup,
    setActiveItem: setActiveItem,
    fetchMyGroups: fetchMyGroups,
    closeCurrentGroup: closeCurrentGroup,
    refreshChannels: refreshChannels
  });

  useMessageAlerts({
    currentUser: currentUser,
    currentGroup: currentGroup,
    activeItem: activeItem,
    channels: channels,
    users: users,
    view: view,
    inspecting: inspecting,
    setUnread: setUnread,
    setMentionUnread: setMentionUnread,
    markRead: markRead,
    showToast: showToast,
    isActiveConversation: isActiveConversation,
    blockedIds: blockedIds
  });

  const handleToastClick = (toast) => {
    setToasts(prev => prev.filter(t => t.id !== toast.id));
    goToTarget(toast.target);
  };

  const handleSearchJump = (result) => {
    setShowSearch(false);
    handleSelectItem(result.type, result.roomId, result.channelId, result.type === 'project' ? 'chat' : null, result.message.id);
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  let page = null;
  if (view === 'messages') {
    page = (
      <MessagesView
        currentUser={currentUser}
        users={users}
        onlineUserIds={onlineUserIds}
        target={messagesTarget}
        onSelectTarget={selectConversation}
        unread={unread}
        mutedRooms={currentUser.mutedRooms || []}
        onToggleMute={handleToggleMute}
        onOpenProfile={setProfileUserId}
      />
    );
  }
  if (view === 'clipboard') {
    page = <ClipboardView currentUser={currentUser} />;
  }
  if (view === 'overview') {
    page = (
      <OverviewView
        currentUser={currentUser}
        myGroups={myGroups}
        onOpenGroup={(group) => openGroup(group)}
        onOpenTask={(task) => goToTarget({ type: 'project', groupId: task.groupId, id: task.projectId, tab: 'tasks' })}
        onEditProfile={() => { setSettingsTab('profile'); setView('settings'); }}
      />
    );
  }
  if (view === 'settings') {
    page = (
      <UserSettingsView
        currentUser={currentUser}
        tab={settingsTab}
        onChangeTab={setSettingsTab}
        onUserUpdated={handleUserUpdated}
        onLogout={handleLogout}
        tierVersion={tierVersion}
        showSaved={showSaved}
      />
    );
  }
  if (view === 'admin' && isStaffUser(currentUser) && !isAdminUser(currentUser)) {
    page = (
      <StaffView
        currentUser={currentUser}
        tab={staffTab}
        onChangeTab={setStaffTab}
        showSaved={showSaved}
      />
    );
  }
  if (view === 'admin' && isAdminUser(currentUser)) {
    page = (
      <AdminView
        currentUser={currentUser}
        tab={adminTab}
        onChangeTab={setAdminTab}
        showSaved={showSaved}
        onInspectGroup={inspectGroup}
      />
    );
  }
  if (view === 'groupSettings' && currentGroup) {
    page = (
      <GroupSettingsView
        group={currentGroup}
        currentUser={currentUser}
        users={users}
        onlineUserIds={onlineUserIds}
        tab={groupSettingsTab}
        onChangeTab={setGroupSettingsTab}
        onBack={() => setView('workspace')}
        onLeft={closeCurrentGroup}
        showSaved={showSaved}
        readOnly={inspecting}
      />
    );
  }
  if (view === 'workspace' && currentGroup) {
    page = (
      <WorkspaceView
        currentGroup={currentGroup}
        currentUser={currentUser}
        users={users}
        channels={channels}
        setChannels={setChannels}
        activeItem={activeItem}
        onSelectItem={handleSelectItem}
        unread={unread}
        mentionUnread={mentionUnread}
        onlineUserIds={onlineUserIds}
        onGroupChange={handleGroupChange}
        onOpenGroupSettings={openGroupSettings}
        onLeaveGroup={handleLeaveGroupFromMenu}
        onOpenSearch={() => setShowSearch(true)}
        onOpenProfile={setProfileUserId}
        readOnly={inspecting}
        onExitInspect={exitInspect}
        showList={workspaceShowList}
        onShowListChange={setWorkspaceShowList}
        projectTab={projectTab}
        onProjectTabChange={setProjectTab}
        mutedRooms={currentUser.mutedRooms || []}
        onToggleMute={handleToggleMute}
      />
    );
  }
  if (!page) {
    page = <LobbyView key={lobbyTab} initialTab={lobbyTab} currentUser={currentUser} myGroups={myGroups} onOpenGroup={(group) => openGroup(group)} onGroupsChanged={fetchMyGroups} />;
  }

  const profileUser = profileUserId ? users.find(u => u.id === profileUserId) : null;
  let messagesUnread = 0;
  Object.keys(unread).forEach(key => {
    const isConversation = key.startsWith('dm:') || key.startsWith('gdm:');
    if (isConversation && !(currentUser.mutedRooms || []).includes(key)) {
      messagesUnread = messagesUnread + unread[key];
    }
  });
  let mobileTitle = PAGE_TITLES[view] || '';
  if ((view === 'workspace' || view === 'groupSettings') && currentGroup) {
    mobileTitle = currentGroup.name;
  }

  const rail = (
    <AppRail
      currentUser={currentUser}
      view={view}
      myGroups={myGroups}
      currentGroup={currentGroup}
      onNavigate={navigate}
      onSelectGroup={selectGroupFromRail}
      onLogout={handleLogout}
      inspectingGroup={inspecting ? currentGroup : null}
      onSetPresence={handleSetPresence}
      notifications={inbox.notifications}
      unreadNotifications={inbox.unreadCount}
      onOpenNotification={handleOpenNotification}
      onReadAllNotifications={() => inbox.markRead(null)}
      messagesUnread={messagesUnread}
      onAddGroup={() => {
        setMobileNavOpen(false);
        setShowAddGroup(true);
      }}
    />
  );

  return (
    <BlockedContext.Provider value={blockedIds}>
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 overflow-hidden">
      <div className="hidden md:flex h-full">{rail}</div>

      <div className="md:hidden h-12 shrink-0 flex items-center gap-2 px-2 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="เปิดเมนู"
        >
          <Icon name="menu" className="w-6 h-6" />
          {inbox.unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />}
        </button>
        <p className="text-base font-semibold text-slate-900 truncate">{mobileTitle}</p>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="h-full">{rail}</div>
          <button type="button" className="flex-1 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} aria-label="ปิดเมนู" />
        </div>
      )}

      <div className="flex-1 min-w-0 min-h-0">{page}</div>

      {showAddGroup && (
        <AddGroupModal
          currentUser={currentUser}
          onClose={() => setShowAddGroup(false)}
          onJoined={async (group) => {
            setShowAddGroup(false);
            await fetchMyGroups();
            openGroup(group);
          }}
          onDiscover={() => {
            setShowAddGroup(false);
            setLobbyTab('discover-' + Date.now());
            setView('lobby');
          }}
        />
      )}

      {showSearch && currentGroup && (
        <SearchModal groupId={currentGroup.id} currentUser={currentUser} users={users} onClose={() => setShowSearch(false)} onJump={handleSearchJump} />
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          group={currentGroup}
          currentUser={currentUser}
          status={getPresence(profileUser, onlineUserIds)}
          onClose={() => setProfileUserId(null)}
          onMessage={() => {
            setProfileUserId(null);
            selectConversation({ type: 'dm', id: profileUser.id });
          }}
          isBlocked={blockedIds.includes(profileUser.id)}
          onToggleBlock={(blocked) => handleToggleBlock(profileUser.id, blocked)}
          onEditProfile={() => {
            setProfileUserId(null);
            setSettingsTab('profile');
            setView('settings');
          }}
        />
      )}


      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 space-y-2 z-50">
        {toasts.map(toast => (
          <button
            key={toast.id}
            type="button"
            onClick={() => handleToastClick(toast)}
            className="w-full text-left bg-white border border-slate-200 shadow-xl rounded-xl px-4 py-3 hover:border-indigo-300 transition-colors flex gap-3"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Icon name="bell" className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{toast.title}</span>
              <span className="block text-sm text-slate-600 truncate">{toast.body}</span>
            </span>
          </button>
        ))}
      </div>

      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          <Icon name="check" className="w-4 h-4 text-emerald-400" />
          บันทึกเรียบร้อย
        </div>
      )}
    </div>
    </BlockedContext.Provider>
  );
}
