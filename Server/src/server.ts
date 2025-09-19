import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import app from './app.js';

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);
const URL = `http://localhost:${PORT}`

export const io = new IOServer(server, {
  path: '/socket.io',
});

io.on('connection', (socket) => {
  socket.on('join-auction', (id: string) => socket.join(`a:${id}`));
});

server.listen(PORT, () => console.log(`Server listening on → ${URL}`));
