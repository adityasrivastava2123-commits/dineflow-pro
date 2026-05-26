import logger from "../utils/logger.js";

/**
 * Role-Based Access Control (RBAC) middleware
 * Roles: admin | manager | staff | kitchen | superadmin | customer
 */
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Access denied: user ${req.user._id} with role '${req.user.role}' attempted to access route requiring [${allowedRoles.join(", ")}]`
      );
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Convenience role guards
 */
export const requireAdmin = roleMiddleware(["admin", "superadmin"]);
export const requireManager = roleMiddleware(["admin", "manager", "superadmin"]);
export const requireStaff = roleMiddleware(["admin", "manager", "staff", "superadmin"]);
export const requireKitchen = roleMiddleware(["admin", "manager", "kitchen", "superadmin"]);
export const requireSuperAdmin = roleMiddleware(["superadmin"]);

export default roleMiddleware;
