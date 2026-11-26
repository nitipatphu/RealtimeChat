export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (err.type === 'entity.parse.failed') statusCode = 400;
  if (err.type === 'entity.too.large') statusCode = 413;

  let message = err.message;
  if (statusCode >= 500) {
    console.error(' Error:', err);
    message = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
  } else if (statusCode === 413) {
    message = 'ข้อมูลที่ส่งมาใหญ่เกินไป';
  } else if (statusCode === 400 && err.type === 'entity.parse.failed') {
    message = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
  }

  res.status(statusCode).json({
    status: 'error',
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error('ไม่พบหน้าที่ต้องการ'));
};
