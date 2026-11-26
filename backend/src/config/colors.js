const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export function pickGroupColor(index) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}
