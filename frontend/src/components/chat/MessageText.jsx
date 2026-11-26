const SPECIAL_TAGS = ['everyone', 'ทุกคน'];

function splitMentions(text, names) {
  const parts = [];
  let plain = '';
  let i = 0;

  while (i < text.length) {
    let foundName = null;
    if (text[i] === '@') {
      for (let n = 0; n < names.length; n++) {
        if (text.startsWith('@' + names[n], i)) {
          foundName = names[n];
          break;
        }
      }
    }

    if (foundName) {
      if (plain) {
        parts.push({ type: 'text', value: plain });
        plain = '';
      }
      parts.push({ type: 'mention', value: foundName });
      i = i + foundName.length + 1;
    } else {
      plain = plain + text[i];
      i = i + 1;
    }
  }

  if (plain) {
    parts.push({ type: 'text', value: plain });
  }
  return parts;
}

const MARKERS = [
  { mark: '**', type: 'bold' },
  { mark: '~~', type: 'strike' },
  { mark: '`', type: 'code' },
  { mark: '*', type: 'italic' }
];

function findLinkEnd(text, start) {
  let end = start;
  while (end < text.length && text[end] !== ' ' && text[end] !== '\n' && text[end] !== '\t') {
    end = end + 1;
  }
  return end;
}

function splitInline(text) {
  const parts = [];
  let plain = '';
  let i = 0;

  const pushPlain = () => {
    if (plain) {
      parts.push({ type: 'plain', value: plain });
      plain = '';
    }
  };

  while (i < text.length) {
    if (text.startsWith('http://', i) || text.startsWith('https://', i)) {
      const end = findLinkEnd(text, i);
      pushPlain();
      parts.push({ type: 'link', value: text.slice(i, end) });
      i = end;
      continue;
    }

    let matched = false;
    for (const marker of MARKERS) {
      if (!text.startsWith(marker.mark, i)) continue;
      const innerStart = i + marker.mark.length;
      const close = text.indexOf(marker.mark, innerStart);
      if (close === -1 || close === innerStart) continue;
      const inner = text.slice(innerStart, close);
      if (inner.includes('\n') || inner.includes(marker.mark[0])) continue;

      pushPlain();
      parts.push({ type: marker.type, value: inner });
      i = close + marker.mark.length;
      matched = true;
      break;
    }
    if (matched) continue;

    plain = plain + text[i];
    i = i + 1;
  }

  pushPlain();
  return parts;
}

function splitCodeBlocks(text) {
  const parts = [];
  const pieces = text.split('```');
  pieces.forEach((piece, index) => {
    const isCode = index % 2 === 1 && index < pieces.length - 1;
    if (isCode) {
      let code = piece;
      if (code.startsWith('\n')) code = code.slice(1);
      if (code.endsWith('\n')) code = code.slice(0, -1);
      parts.push({ type: 'block', value: code });
    } else if (piece) {
      const value = index % 2 === 1 ? '```' + piece : piece;
      parts.push({ type: 'text', value: value });
    }
  });
  return parts;
}

export default function MessageText({ text, users, currentUser }) {
  if (!text) return null;

  const names = (users || []).map(u => u.name).concat(SPECIAL_TAGS);
  names.sort((a, b) => b.length - a.length);

  const renderMentions = (value, keyPrefix) => {
    return splitMentions(value, names).map((part, index) => {
      if (part.type === 'text') {
        return <span key={keyPrefix + index}>{part.value}</span>;
      }
      const isMe = currentUser && (part.value === currentUser.name || SPECIAL_TAGS.includes(part.value));
      return (
        <span key={keyPrefix + index} className={`px-1 rounded font-medium ${isMe ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>
          @{part.value}
        </span>
      );
    });
  };

  const renderInline = (value, keyPrefix) => {
    return splitInline(value).map((part, index) => {
      const key = keyPrefix + '-' + index;
      if (part.type === 'bold') return <strong key={key} className="font-semibold text-slate-900">{part.value}</strong>;
      if (part.type === 'italic') return <em key={key}>{part.value}</em>;
      if (part.type === 'strike') return <s key={key} className="text-slate-500">{part.value}</s>;
      if (part.type === 'code') {
        return <code key={key} className="px-1.5 py-0.5 rounded bg-slate-100 text-[13px] font-mono text-pink-600">{part.value}</code>;
      }
      if (part.type === 'link') {
        return (
          <a key={key} href={part.value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline break-all">
            {part.value}
          </a>
        );
      }
      return <span key={key}>{renderMentions(part.value, key + 'm')}</span>;
    });
  };

  return (
    <div className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
      {splitCodeBlocks(text).map((part, index) => {
        if (part.type === 'block') {
          return (
            <pre key={index} className="my-1.5 p-3 rounded-lg bg-[#0f172a] text-[#e2e8f0] text-[13px] font-mono overflow-x-auto whitespace-pre">
              {part.value}
            </pre>
          );
        }
        return <span key={index}>{renderInline(part.value, 'p' + index)}</span>;
      })}
    </div>
  );
}
