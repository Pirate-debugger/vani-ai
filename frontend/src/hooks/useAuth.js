/**
 * useAuth — re-exports from AuthContext.
 * Authentication is now fully backend-session-based (Prisma + bcrypt).
 * Import directly from '../context/AuthContext' for new code.
 */
export { useAuth } from '../context/AuthContext';
