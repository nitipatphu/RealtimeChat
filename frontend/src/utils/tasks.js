export function getAssigneeIds(task) {
  if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
  return task.assigneeId ? [task.assigneeId] : [];
}
