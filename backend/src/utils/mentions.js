export function findMentions(text, members, allowEveryone) {
  if (!text) return [];

  if (allowEveryone && (text.includes('@everyone') || text.includes('@ทุกคน'))) {
    return members.map(m => m.id);
  }

  const sortedMembers = [...members].sort((a, b) => b.name.length - a.name.length);
  const mentionedIds = [];
  let remainingText = text;

  sortedMembers.forEach(member => {
    const tag = '@' + member.name;
    if (remainingText.includes(tag)) {
      mentionedIds.push(member.id);
      remainingText = remainingText.split(tag).join(' ');
    }
  });

  return mentionedIds;
}
