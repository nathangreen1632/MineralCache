// Client/src/lib/socket.ts
import { io, type Socket } from 'socket.io-client';

let sock: Socket | null = null;

export function getSocket(): Socket {
  if (sock) return sock;
  // Same-origin only; no CORS
  sock = io('/', { path: '/socket.io', withCredentials: true, autoConnect: true });
  return sock;
}
