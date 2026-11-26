import Swal from 'sweetalert2';

const BUTTON_COLOR = '#4f46e5';
const DANGER_COLOR = '#dc2626';
const CANCEL_COLOR = '#94a3b8';
const TEXT_CLASS = { htmlContainer: 'whitespace-pre-line' };

function isDangerText(text) {
  const words = ['ลบ', 'แบน', 'ออกจาก', 'ระงับ', 'บล็อก', 'โอน', 'นำ'];
  let found = false;
  words.forEach(word => {
    if (String(text).includes(word)) found = true;
  });
  return found;
}

export function isDialogOpen() {
  return Swal.isVisible();
}

export function closeDialog() {
  Swal.close();
}

export function showAlert(text) {
  return Swal.fire({
    text: String(text),
    customClass: TEXT_CLASS,
    icon: 'info',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: BUTTON_COLOR
  });
}

export function showError(text) {
  return Swal.fire({
    title: 'ทำรายการไม่สำเร็จ',
    text: String(text),
    customClass: TEXT_CLASS,
    icon: 'error',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: BUTTON_COLOR
  });
}

export function showSuccess(text) {
  return Swal.fire({
    text: String(text),
    customClass: TEXT_CLASS,
    icon: 'success',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: BUTTON_COLOR
  });
}

export async function askConfirm(text) {
  const danger = isDangerText(text);
  let color = BUTTON_COLOR;
  if (danger) color = DANGER_COLOR;

  const result = await Swal.fire({
    text: String(text),
    customClass: TEXT_CLASS,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: color,
    cancelButtonColor: CANCEL_COLOR,
    reverseButtons: true,
    focusCancel: danger
  });
  return result.isConfirmed;
}

export async function askText(text, defaultValue) {
  const result = await Swal.fire({
    text: String(text),
    customClass: TEXT_CLASS,
    input: 'text',
    inputValue: defaultValue || '',
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: BUTTON_COLOR,
    cancelButtonColor: CANCEL_COLOR,
    reverseButtons: true
  });
  if (!result.isConfirmed) return null;
  return result.value;
}

export function showCopyBox(text) {
  return Swal.fire({
    title: 'คัดลอกข้อความนี้',
    input: 'text',
    inputValue: text,
    inputAttributes: { readonly: 'readonly' },
    confirmButtonText: 'ปิด',
    confirmButtonColor: BUTTON_COLOR,
    didOpen: () => {
      const input = Swal.getInput();
      if (input) input.select();
    }
  });
}
