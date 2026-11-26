export function mergeMessages(oldList, newList) {
  const result = [...(oldList || [])];
  (newList || []).forEach(message => {
    const index = result.findIndex(m => m.id === message.id);
    if (index === -1) {
      result.push(message);
    } else {
      result[index] = message;
    }
  });
  result.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return result;
}

export function getOldestTime(messages) {
  const topLevel = (messages || []).filter(m => !m.parentId);
  if (topLevel.length === 0) return '';
  return topLevel[0].createdAt || '';
}

export function getLastId(messages) {
  const topLevel = (messages || []).filter(m => !m.parentId);
  if (topLevel.length === 0) return null;
  return topLevel[topLevel.length - 1].id;
}
