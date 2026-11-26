import { useState, useEffect } from 'react';
import { apiGet, apiSend } from '../../api';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { GroupAvatar } from '../ui/Avatar';
import { VisibilityBadge, RoleBadge } from '../ui/Badge';
import Card, { EmptyState, PageHeader, Tabs } from '../ui/Card';
import { ErrorBox, inputClass } from '../ui/Form';
import CreateGroupModal from './CreateGroupModal';
import { getMemberRole } from '../../utils/permissions';

function MyGroupCard({ group, currentUser, onOpen }) {
  const role = getMemberRole(group, currentUser.id);

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <GroupAvatar group={group} size="lg" />
        <VisibilityBadge visibility={group.visibility} />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mt-4 truncate">{group.name}</h3>
      <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-10">{group.description || 'ไม่มีคำอธิบาย'}</p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <Icon name="users" className="w-4 h-4" />
          {group.members.length} สมาชิก
        </span>
        <RoleBadge role={role} />
      </div>
    </button>
  );
}

function PublicGroupRow({ group, onJoin, joining }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl">
      <GroupAvatar group={group} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{group.name}</p>
        <p className="text-sm text-slate-500 truncate">{group.description || 'ไม่มีคำอธิบาย'}</p>
        <p className="text-xs text-slate-400 mt-1">
          {group.memberCount} สมาชิก · {group.projectCount} โปรเจกต์ · เจ้าของ {group.ownerName}
        </p>
      </div>
      <Button size="sm" icon="plus" onClick={() => onJoin(group)} disabled={joining}>
        เข้าร่วม
      </Button>
    </div>
  );
}

export default function LobbyView({ currentUser, myGroups, onOpenGroup, onGroupsChanged, initialTab }) {
  const [tab, setTab] = useState(initialTab && initialTab.startsWith('discover') ? 'discover' : 'mine');
  const [showCreate, setShowCreate] = useState(false);
  const [publicGroups, setPublicGroups] = useState(null);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (tab !== 'discover') return;
    apiGet('/groups/discover?q=' + encodeURIComponent(searchQuery))
      .then(data => setPublicGroups(data))
      .catch(err => console.error(err));
  }, [tab, searchQuery, currentUser.id, myGroups.length]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPublicGroups(null);
    setSearchQuery(search);
  };

  const handleJoinCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setJoinError('');
    try {
      const data = await apiSend('POST', '/groups/join', { inviteCode: joinCode });
      setJoinCode('');
      await onGroupsChanged();
      onOpenGroup(data.group);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleJoinPublic = async (group) => {
    setJoining(true);
    try {
      const data = await apiSend('POST', '/groups/' + group.id + '/join', {});
      await onGroupsChanged();
      onOpenGroup(data.group);
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleCreated = async (group) => {
    setShowCreate(false);
    await onGroupsChanged();
    onOpenGroup(group);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <PageHeader
          title={'สวัสดี, ' + currentUser.name}
          description="เลือกกลุ่มเพื่อเริ่มคุย หรือค้นหากลุ่มใหม่ที่เปิดเป็น Public"
          action={<Button icon="plus" onClick={() => setShowCreate(true)}>สร้างกลุ่มใหม่</Button>}
        />

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'mine', label: 'กลุ่มของฉัน (' + myGroups.length + ')', icon: 'grid' },
                { id: 'discover', label: 'ค้นหากลุ่ม Public', icon: 'globe' }
              ]}
            />

            {tab === 'mine' && (
              myGroups.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="users"
                    title="ยังไม่มีกลุ่ม"
                    text="สร้างกลุ่มแรกของคุณ ใส่รหัสเชิญ หรือค้นหากลุ่ม Public"
                    action={<Button variant="soft" onClick={() => setTab('discover')}>ค้นหากลุ่ม Public</Button>}
                  />
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {myGroups.map(group => (
                    <MyGroupCard key={group.id} group={group} currentUser={currentUser} onOpen={onOpenGroup} />
                  ))}
                </div>
              )
            )}

            {tab === 'discover' && (
              <div>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Icon name="search" className="w-[18px] h-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อกลุ่ม..." className={inputClass + ' pl-10'} />
                  </div>
                  <Button type="submit" variant="secondary">ค้นหา</Button>
                </form>

                {publicGroups === null && <p className="text-sm text-slate-500">กำลังโหลด...</p>}

                {publicGroups !== null && publicGroups.length === 0 && (
                  <Card>
                    <EmptyState icon="globe" title="ไม่พบกลุ่ม Public" text="ลองค้นหาด้วยคำอื่น หรือคุณอาจเข้าร่วมทุกกลุ่มแล้ว" />
                  </Card>
                )}

                <div className="space-y-3">
                  {(publicGroups || []).map(group => (
                    <PublicGroupRow key={group.id} group={group} onJoin={handleJoinPublic} joining={joining} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Card title="มีรหัสเชิญ?" description="ใช้สำหรับเข้ากลุ่มแบบ Private">
            <form onSubmit={handleJoinCode} className="space-y-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="เช่น DEV123"
                className={inputClass + ' font-mono tracking-widest uppercase'}
                maxLength={10}
              />
              <ErrorBox message={joinError} />
              <Button type="submit" variant="secondary" icon="login" className="w-full" disabled={joining || !joinCode.trim()}>
                เข้าร่วมด้วยรหัส
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {showCreate && (
        <CreateGroupModal currentUser={currentUser} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
