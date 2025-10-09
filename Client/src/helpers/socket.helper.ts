import { io, type Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;
  _socket = io('/', {
    path: '/socket.io',
    withCredentials: true,
    autoConnect: true,
    transports: ['websocket'],
  });
  return _socket;
}

export function auctionRoomName(id: number | string): string {
  return `auction:${id}`;
}
