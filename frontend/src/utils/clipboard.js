import { showCopyBox } from './dialog';

function copyWithTextarea(text) {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.position = 'fixed';
  box.style.top = '0';
  box.style.left = '0';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.focus();
  box.select();
  box.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (error) {
    console.error(error);
  }

  document.body.removeChild(box);
  if (!ok) {
    showCopyBox(text);
  }
}

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text));
    return;
  }
  copyWithTextarea(text);
}
