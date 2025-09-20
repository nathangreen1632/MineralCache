// Augment Express Request with a `user` bag and cookie-session typing.
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      role: 'buyer' | 'vendor' | 'admin';
      dobVerified18: boolean;
      email?: string;
    } | null;
  }
}

// If you want stricter cookie-session typing, you can also add:
declare module 'cookie-session' {
  interface CookieSessionObject {
    user?: { id: number; role: 'buyer'|'vendor'|'admin'; dobVerified18: boolean; email?: string } | null;
  }
}
