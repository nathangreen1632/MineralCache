// Client/src/lib/socket.ts
import { io, type Socket } from 'socket.io-client';

let sock: Socket | null = null;

export function getSocket(): Socket {
  if (sock) return sock;
  // Same-origin only; no CORS. Server socket path is /socket.io
  sock = io('/', {
    path: '/socket.io',
    withCredentials: true,
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
  return sock;
}

export function joinRoom(room: string): void {
  const s = getSocket();
  s.emit('room:join', { room });
}

export function leaveRoom(room: string): void {
  const s = getSocket();
  s.emit('room:leave', { room });
}

export function on<T = any>(event: string, handler: (payload: T) => void): void {
  getSocket().on(event, handler as any);
}

export function off(event: string, handler?: (...args: any[]) => void): void {
  const s = getSocket();
  if (handler) s.off(event, handler as any);
  else s.off(event);
}
