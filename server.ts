import express from 'express';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface User {
  userId: string;
  socketId: string;
  username: string;
  country: string;
  gender: string;
  mode: 'text' | 'video' | 'voice';
  status: 'IDLE' | 'WAITING' | 'MATCHED';
  roomId?: string;
}

const activeUsers = new Map<string, User>();
const queues = {
  text: [] as string[],
  video: [] as string[],
  voice: [] as string[]
};

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const matchmake = (mode: 'text' | 'video' | 'voice') => {
    const queue = queues[mode];
    while (queue.length >= 2) {
      const socketId1 = queue.shift();
      const socketId2 = queue.shift();

      if (!socketId1 || !socketId2) continue;

      const user1 = activeUsers.get(socketId1);
      const user2 = activeUsers.get(socketId2);
      const socket1 = io.sockets.sockets.get(socketId1);
      const socket2 = io.sockets.sockets.get(socketId2);

      // If either user disconnected or socket is gone, put the other back in queue
      if (!user1 || !socket1 || !socket1.connected) {
        if (user2 && socket2 && socket2.connected) queue.unshift(socketId2);
        continue;
      }
      if (!user2 || !socket2 || !socket2.connected) {
        if (user1 && socket1 && socket1.connected) queue.unshift(socketId1);
        continue;
      }

      // Both are valid, create match
      const roomId = uuidv4();
      
      user1.status = 'MATCHED';
      user1.roomId = roomId;
      user2.status = 'MATCHED';
      user2.roomId = roomId;

      socket1.join(roomId);
      socket2.join(roomId);

      socket1.emit('match_found', {
        roomId,
        partnerId: user2.userId,
        partnerName: user2.username,
        partnerCountry: user2.country,
        partnerGender: user2.gender,
        isInitiator: true
      });

      socket2.emit('match_found', {
        roomId,
        partnerId: user1.userId,
        partnerName: user1.username,
        partnerCountry: user1.country,
        partnerGender: user1.gender,
        isInitiator: false
      });
    }
  };

  io.on('connection', (socket) => {
    console.log(`[DEBUG] Socket connected: ${socket.id}`);

    socket.on('join_queue', (data: { userId: string; username: string; country: string; gender: string; mode: 'text' | 'video' | 'voice' }) => {
      const { userId, username, country, gender, mode } = data;
      
      // Remove from existing queues if already present
      const existingUser = activeUsers.get(socket.id);
      if (existingUser) {
        const q = queues[existingUser.mode];
        const index = q.indexOf(socket.id);
        if (index !== -1) q.splice(index, 1);
      }

      const newUser: User = {
        userId,
        socketId: socket.id,
        username,
        country,
        gender,
        mode,
        status: 'WAITING',
      };

      activeUsers.set(socket.id, newUser);
      queues[mode].push(socket.id);
      
      matchmake(mode);
    });

    socket.on('skip', () => {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      const roomId = user.roomId;
      if (roomId) {
        socket.leave(roomId);
        socket.to(roomId).emit('partner_left');
        
        // Find partner and update their status
        for (const [sId, u] of activeUsers.entries()) {
          if (u.roomId === roomId && sId !== socket.id) {
            u.status = 'WAITING';
            u.roomId = undefined;
            const partnerSocket = io.sockets.sockets.get(sId);
            if (partnerSocket) partnerSocket.leave(roomId);
            queues[u.mode].push(sId);
          }
        }
      }

      user.status = 'WAITING';
      user.roomId = undefined;
      queues[user.mode].push(socket.id);
      
      matchmake(user.mode);
    });

    socket.on('leave_queue', () => {
      const user = activeUsers.get(socket.id);
      if (user) {
        const q = queues[user.mode];
        const index = q.indexOf(socket.id);
        if (index !== -1) q.splice(index, 1);
        user.status = 'IDLE';
      }
    });

    socket.on('send_message', (data: { roomId: string; text: string; imageUrl?: string }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      socket.to(data.roomId).emit('receive_message', {
        from: user.userId,
        text: data.text,
        imageUrl: data.imageUrl
      });
    });

    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      socket.to(data.roomId).emit('partner_typing', { isTyping: data.isTyping });
    });

    socket.on('webrtc_signal', (data: { roomId: string; signal: any }) => {
      socket.to(data.roomId).emit('webrtc_signal', { signal: data.signal });
    });

    socket.on('disconnect', () => {
      const user = activeUsers.get(socket.id);
      if (user) {
        const q = queues[user.mode];
        const index = q.indexOf(socket.id);
        if (index !== -1) q.splice(index, 1);

        if (user.roomId) {
          socket.to(user.roomId).emit('partner_left');
          
          // Clean up partner's room state and put them back in queue
          for (const [sId, u] of activeUsers.entries()) {
            if (u.roomId === user.roomId && sId !== socket.id) {
              u.status = 'WAITING';
              u.roomId = undefined;
              const partnerSocket = io.sockets.sockets.get(sId);
              if (partnerSocket) partnerSocket.leave(user.roomId);
              queues[u.mode].push(sId);
              matchmake(u.mode);
            }
          }
        }
        activeUsers.delete(socket.id);
      }
      console.log(`[DEBUG] Socket disconnected: ${socket.id}`);
    });
  });

  // Next.js handler
  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
