export function getLastDays(count) {
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    days.push({ date: toDateKey(date), count: 0 });
  }
  return days;
}

export function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function addToDay(days, createdAt, amount) {
  if (!createdAt) return;
  const key = toDateKey(createdAt);
  const day = days.find(d => d.date === key);
  if (day) {
    day.count = day.count + (amount || 1);
  }
}
