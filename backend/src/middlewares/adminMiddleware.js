function checkSystemRole(req, res, next, allowedRoles) {
  if (!req.authUser || !allowedRoles.includes(req.authUser.system_role)) {
    res.status(403);
    throw new Error('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }
  req.adminUser = { id: req.authUser.id, name: req.authUser.name, systemRole: req.authUser.system_role };
  next();
}

export const requireStaff = (req, res, next) => {
  checkSystemRole(req, res, next, ['administrator', 'staff']);
};

export const requireAdmin = (req, res, next) => {
  checkSystemRole(req, res, next, ['administrator']);
};
