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
  id: string;
  socketId: string;
  username: string;
  country: string;
  gender: string;
  mode: 'text' | 'video' | 'voice';
  status: 'IDLE' | 'WAITING' | 'MATCHED';
  roomId?: string;
}

const queues: Record<string, User[]> = {
  text: [],
  video: [],
  voice: [],
};

const activeUsers = new Map<string, User>();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`[DEBUG] Socket connected: ${socket.id}`);

    socket.on('join_queue', (data: { userId: string; username: string; country: string; gender: string; mode: 'text' | 'video' | 'voice' }) => {
      const { userId, username, country, gender, mode } = data;
      console.log(`[DEBUG] join_queue received from ${userId} (${username}) for mode ${mode}`);
      
      // Log current queue states
      Object.keys(queues).forEach(m => {
        console.log(`[DEBUG] Queue ${m} length: ${queues[m].length}`);
        const initialLen = queues[m].length;
        queues[m] = queues[m].filter(u => u.id !== userId);
        if (queues[m].length < initialLen) {
          console.log(`[DEBUG] Removed ${userId} from queue ${m}`);
        }
      });

      // Remove any existing entry for this userId to handle reconnections
      for (const [sid, user] of activeUsers.entries()) {
        if (user.id === userId) {
          activeUsers.delete(sid);
          queues[user.mode] = queues[user.mode].filter(u => u.id !== userId);
        }
      }

      const newUser: User = {
        id: userId,
        socketId: socket.id,
        username,
        country,
        gender,
        mode,
        status: 'WAITING',
      };

      activeUsers.set(socket.id, newUser);
      console.log(`[DEBUG] User added to activeUsers: ${userId} (${username}) for mode: ${mode}`);

      // Broadcast queue status
      const getQueueStatus = () => {
        const status: Record<string, number> = {};
        Object.keys(queues).forEach(m => {
          status[m] = queues[m].length;
        });
        return status;
      };
      io.emit('queue_status', getQueueStatus());

      // Instant Matchmaking Logic
      let matched = false;
      console.log(`[DEBUG] Attempting to match ${userId}. Queue length for ${mode}: ${queues[mode].length}`);
      
      while (queues[mode].length > 0) {
        const partner = queues[mode].shift()!;
        console.log(`[DEBUG] Checking potential partner: ${partner.id} (Socket: ${partner.socketId})`);
        
        const partnerSocket = io.sockets.sockets.get(partner.socketId);
        console.log(`[DEBUG] Partner socket found: ${!!partnerSocket}`);
        if (partnerSocket) {
          console.log(`[DEBUG] Partner socket connected: ${partnerSocket.connected}`);
        }

        if (partnerSocket && partnerSocket.connected) {
          console.log(`[DEBUG] Partner ${partner.id} is connected. Finalizing match.`);
          const roomId = uuidv4();
          
          newUser.status = 'MATCHED';
          newUser.roomId = roomId;
          partner.status = 'MATCHED';
          partner.roomId = roomId;

          console.log(`[DEBUG] Match created: ${userId} <-> ${partner.id} in room: ${roomId}`);

          // Join rooms
          socket.join(roomId);
          partnerSocket.join(roomId);
          
          // Emit match_found to both
          socket.emit('match_found', {
            roomId,
            partnerId: partner.id,
            partnerName: partner.username,
            partnerCountry: partner.country,
            partnerGender: partner.gender,
            isInitiator: true
          });

          partnerSocket.emit('match_found', {
            roomId,
            partnerId: userId,
            partnerName: username,
            partnerCountry: country,
            partnerGender: gender,
            isInitiator: false
          });

          matched = true;
          // Update queue status after match
          io.emit('queue_status', getQueueStatus());
          break;
        } else {
          console.log(`[DEBUG] Skipping disconnected partner ${partner.id} in queue ${mode}`);
        }
      }

      if (!matched) {
        console.log(`[DEBUG] No partner found for ${userId}, adding to queue ${mode}`);
        queues[mode].push(newUser);
        // Update queue status after adding to queue
        io.emit('queue_status', getQueueStatus());
      }
    });

    socket.on('leave_queue', () => {
      const user = activeUsers.get(socket.id);
      if (user) {
        queues[user.mode] = queues[user.mode].filter(u => u.socketId !== socket.id);
        activeUsers.delete(socket.id);
        console.log(`[DEBUG] User removed from queue: ${user.id}`);
      }
    });

    socket.on('send_message', (data: { roomId: string; text: string; imageUrl?: string }) => {
      socket.to(data.roomId).emit('receive_message', {
        from: activeUsers.get(socket.id)?.id,
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
        queues[user.mode] = queues[user.mode].filter(u => u.socketId !== socket.id);
        if (user.roomId) {
          socket.to(user.roomId).emit('partner_left');
          console.log(`[DEBUG] Match cancelled: User ${user.id} disconnected from room ${user.roomId}`);
        }
        activeUsers.delete(socket.id);
        console.log(`[DEBUG] User removed from queue/active: ${user.id}`);
      }
      console.log(`[DEBUG] Socket disconnected: ${socket.id}`);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
