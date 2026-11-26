export function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}
