import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Protect routes - verifies JWT
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_prod_12345!');
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid or expired',
    });
  }
};

// Restrict to Admin only
export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Forbidden: Admin access required',
  });
};

// Restrict DepartmentStaff to their assigned department
export const checkDepartmentAccess = (departmentGetter) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.role === 'Admin') {
      return next();
    }

    const targetDept = typeof departmentGetter === 'function' ? await departmentGetter(req) : req[departmentGetter];

    if (!targetDept || targetDept !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You only have access to the ${req.user.department} department`,
      });
    }

    next();
  };
};

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_prod_12345!', {
    expiresIn: '24h',
  });
};
