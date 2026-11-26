import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskModal from '../modals/TaskModal';
import { PRIORITY_STYLE } from '../../utils/constants';
import { getAssigneeIds } from '../../utils/tasks';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { IconButton } from '../ui/Button';
import Button from '../ui/Button';
import { inputBaseClass } from '../ui/Form';
import { askConfirm } from '../../utils/dialog';

function AssigneeStack({ people }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <span className="flex -space-x-2 shrink-0" title={'ผู้รับผิดชอบ: ' + people.map(p => p.name).join(', ')}>
      {shown.map(person => (
        <span key={person.id} className="rounded-full ring-2 ring-white">
          <Avatar src={person.avatar} name={person.name} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="w-7 h-7 rounded-full ring-2 ring-white bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center justify-center">+{extra}</span>
      )}
    </span>
  );
}

function TaskCardDetails({ task, members }) {
  const assignees = getAssigneeIds(task).map(id => members.find(m => m.id === id)).filter(Boolean);
  const priority = PRIORITY_STYLE[task.priority];

  let dueLabel = '';
  let isOverdue = false;
  if (task.dueDate) {
    const due = new Date(task.dueDate + 'T23:59:59');
    isOverdue = due < new Date();
    dueLabel = new Date(task.dueDate + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }

  const checklist = task.checklist || [];
  const doneCount = checklist.filter(item => item.done).length;
  const commentCount = (task.comments || []).length;

  if (assignees.length === 0 && !priority && !task.dueDate && !task.description && checklist.length === 0 && commentCount === 0) return null;

  return (
    <div className="flex items-center justify-between mt-3">
      <div className="flex items-center flex-wrap gap-1.5">
        {priority && (
          <span className={`text-xs font-medium px-2 h-6 inline-flex items-center rounded-md ${priority.cls}`}>{priority.label}</span>
        )}
        {task.dueDate && (
          <span className={`text-xs px-2 h-6 inline-flex items-center gap-1 rounded-md ${isOverdue ? 'bg-red-50 text-red-600 font-medium' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name="calendar" className="w-3.5 h-3.5" />
            {dueLabel}
          </span>
        )}
        {checklist.length > 0 && (
          <span className={`text-xs px-2 h-6 inline-flex items-center gap-1 rounded-md ${doneCount === checklist.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name="checkSquare" className="w-3.5 h-3.5" />
            {doneCount}/{checklist.length}
          </span>
        )}
        {commentCount > 0 && (
          <span className="text-xs text-slate-500 inline-flex items-center gap-1" title="คอมเมนต์">
            <Icon name="chat" className="w-3.5 h-3.5" />
            {commentCount}
          </span>
        )}
        {task.description && (
          <span className="text-slate-400" title="มีรายละเอียด">
            <Icon name="list" className="w-4 h-4" />
          </span>
        )}
      </div>
      <AssigneeStack people={assignees} />
    </div>
  );
}

export default function ProjectTaskBoard({ project, members, setProjects, readOnly, groupId, currentUser, users }) {
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingTaskToCol, setAddingTaskToCol] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingColId, setEditingColId] = useState(null);
  const [editColTitle, setEditColTitle] = useState('');

  const columns = project.columns || [];
  const tasks = project.tasks || [];

  const updateThisProject = (changeFn) => {
    setProjects(prev => prev.map(p => (p.id === project.id ? changeFn(p) : p)));
  };

  const handleAddColumn = (e) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    const newCol = { id: 'col-' + Date.now(), title: newColumnTitle.trim() };
    updateThisProject(p => ({ ...p, columns: [...(p.columns || []), newCol] }));
    setNewColumnTitle('');
  };

  const handleDeleteColumn = async (colId) => {
    const confirmed = await askConfirm('ยืนยันการลบคอลัมน์นี้? งานทั้งหมดในคอลัมน์นี้จะหายไปด้วย');
    if (!confirmed) return;
    updateThisProject(p => ({
      ...p,
      columns: p.columns.filter(c => c.id !== colId),
      tasks: p.tasks.filter(t => t.status !== colId)
    }));
  };

  const saveColTitle = (colId) => {
    if (!editColTitle.trim()) {
      setEditingColId(null);
      return;
    }
    updateThisProject(p => ({
      ...p,
      columns: p.columns.map(c => (c.id === colId ? { ...c, title: editColTitle.trim() } : c))
    }));
    setEditingColId(null);
  };

  const handleAddTask = (e, colId) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask = { id: 't' + Date.now(), title: newTaskTitle.trim(), status: colId, assigneeIds: [] };
    updateThisProject(p => ({ ...p, tasks: [...(p.tasks || []), newTask] }));
    setNewTaskTitle('');
    setAddingTaskToCol(null);
  };

  const removeTask = (taskId) => {
    setSelectedTaskId(null);
    updateThisProject(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) }));
  };

  const handleSaveTask = (updatedTask) => {
    updateThisProject(p => ({ ...p, tasks: p.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t)) }));
    setSelectedTaskId(null);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const matchesFilter = (task) => {
    if (assigneeFilter === 'all') return true;
    const ids = getAssigneeIds(task);
    if (assigneeFilter === 'me') return ids.includes(currentUser.id);
    if (assigneeFilter === 'none') return ids.length === 0;
    if (assigneeFilter === 'shared') return ids.length > 1;
    return ids.includes(assigneeFilter);
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;

    if (type === 'column') {
      if (source.index === destination.index) return;
      updateThisProject(p => {
        const newColumns = [...(p.columns || [])];
        const [movedCol] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, movedCol);
        return { ...p, columns: newColumns };
      });
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    updateThisProject(p => {
      const allTasks = p.tasks || [];
      const moving = allTasks.find(t => t.id === draggableId);
      if (!moving) return p;
      const movedTask = { ...moving, status: destination.droppableId };
      const newTasks = allTasks.filter(t => t.id !== draggableId);
      const targetTasks = newTasks.filter(t => t.status === destination.droppableId && matchesFilter(t));

      let insertAt = newTasks.length;
      if (destination.index < targetTasks.length) {
        insertAt = newTasks.indexOf(targetTasks[destination.index]);
      } else if (targetTasks.length > 0) {
        insertAt = newTasks.indexOf(targetTasks[targetTasks.length - 1]) + 1;
      }
      newTasks.splice(insertAt, 0, movedTask);
      return { ...p, tasks: newTasks };
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 p-3 sm:p-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 mb-5 shrink-0">
      <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={inputBaseClass + ' h-10 w-44'}>
        <option value="all">งานทั้งหมด</option>
        <option value="me">งานของฉัน</option>
        <option value="none">ยังไม่มอบหมาย</option>
        <option value="shared">งานที่ทำร่วมกันหลายคน</option>
        {members.filter(m => m.id !== currentUser.id).map(m => (
          <option key={m.id} value={m.id}>งานของ {m.name}</option>
        ))}
      </select>
      {!readOnly && (
      <form onSubmit={handleAddColumn} className="flex items-center gap-2 flex-1">
        <input
          type="text"
          value={newColumnTitle}
          onChange={e => setNewColumnTitle(e.target.value)}
          placeholder="ชื่อคอลัมน์ใหม่ เช่น Review"
          className={inputBaseClass + ' w-full max-w-xs h-10'}
        />
        <Button type="submit" variant="secondary" icon="plus">เพิ่มคอลัมน์</Button>
      </form>
      )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="column" direction="horizontal">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="flex items-start gap-4 flex-1 min-h-0 overflow-x-auto pb-2">
              {columns.map((col, index) => {
                const colTasks = tasks.filter(t => t.status === col.id && matchesFilter(t));
                return (
                  <Draggable key={col.id} draggableId={col.id} index={index} isDragDisabled={readOnly}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="w-72 bg-slate-100 rounded-2xl flex flex-col shrink-0 max-h-full"
                        style={{ ...provided.draggableProps.style }}
                      >
                        <div {...provided.dragHandleProps} className="flex items-center justify-between px-3 pt-3 pb-2 group cursor-grab active:cursor-grabbing">
                          {editingColId === col.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={editColTitle}
                              onChange={(e) => setEditColTitle(e.target.value)}
                              onBlur={() => saveColTitle(col.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveColTitle(col.id);
                              }}
                              className="w-full h-8 text-sm font-semibold text-slate-800 bg-white px-2 rounded-lg border border-indigo-300 focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <h3
                                className="text-sm font-semibold text-slate-800 truncate"
                                onDoubleClick={() => { if (!readOnly) { setEditingColId(col.id); setEditColTitle(col.title); } }}
                                title="ดับเบิลคลิกเพื่อแก้ไขชื่อ"
                              >
                                {col.title}
                              </h3>
                              <span className="text-xs font-medium text-slate-500 bg-white px-2 h-5 rounded-full inline-flex items-center">{colTasks.length}</span>
                            </div>
                          )}
                          <div className={readOnly ? 'hidden' : 'hidden group-hover:flex'}>
                            <IconButton icon="pencil" title="แก้ชื่อคอลัมน์" size="sm" onClick={() => { setEditingColId(col.id); setEditColTitle(col.title); }} />
                            <IconButton icon="trash" title="ลบคอลัมน์" size="sm" danger onClick={() => handleDeleteColumn(col.id)} />
                          </div>
                        </div>

                        <Droppable droppableId={col.id} type="task">
                          {(provided, snapshot) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[120px] rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/60' : ''}`}
                            >
                              {colTasks.map((task, taskIndex) => (
                                <Draggable key={task.id} draggableId={task.id} index={taskIndex} isDragDisabled={readOnly}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedTaskId(task.id)}
                                      className={`cursor-pointer bg-white p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors ${snapshot.isDragging ? 'shadow-xl ring-2 ring-indigo-500' : 'shadow-sm'}`}
                                      style={{ ...provided.draggableProps.style }}
                                    >
                                      <p className="text-sm font-medium text-slate-800 break-words">{task.title}</p>
                                      <TaskCardDetails task={task} members={members} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {!readOnly && (
                        <div className="p-2 pt-0">
                          {addingTaskToCol === col.id ? (
                            <form onSubmit={(e) => handleAddTask(e, col.id)} className="bg-white p-2 rounded-xl border border-indigo-300">
                              <input
                                type="text"
                                autoFocus
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="ชื่องาน..."
                                className="w-full text-sm focus:outline-none mb-2 px-1 bg-transparent text-slate-800"
                              />
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => setAddingTaskToCol(null)}>ยกเลิก</Button>
                                <Button size="sm" type="submit">เพิ่ม</Button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setAddingTaskToCol(col.id); setNewTaskTitle(''); }}
                              className="w-full h-9 flex items-center gap-1.5 px-2.5 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
                            >
                              <Icon name="plus" className="w-4 h-4" />
                              เพิ่มงาน
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          columns={columns}
          members={members}
          onSave={handleSaveTask}
          onDelete={removeTask}
          onClose={() => setSelectedTaskId(null)}
          groupId={groupId}
          projectId={project.id}
          currentUser={currentUser}
          users={users}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
