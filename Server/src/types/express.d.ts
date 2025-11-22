// Server/src/types/express.d.ts

// Make this file a module (prevents global re-declarations)
export {};

/**
 * Global Express typings you can reuse elsewhere (e.g., cookie-session)
 */
declare global {
  namespace Express {
    type UserRole = 'buyer' | 'vendor' | 'admin';

    interface UserClaims {
      id: number;
      role: UserRole;
      dobVerified18: boolean;
      email?: string;
    }
  }
}

/**
 * Augment Express Request with a `user` bag
 */
declare module 'express-serve-static-core' {
  interface Request {
    session?: any;
    files?: any;
  }
}

/**
 * Optional: stricter cookie-session typing to match the same shape
 */
declare module 'cookie-session' {
  interface CookieSessionObject {
    user?: Express.UserClaims | null;
  }
}
