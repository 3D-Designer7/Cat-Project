import Redis from 'ioredis';

// Use REDIS_URL if provided, otherwise fallback to a local instance
// In a real production environment, this would strictly connect to a Redis cluster
const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
}) : null;

if (redis) {
  redis.on('error', (err) => console.error('Redis Client Error', err));
  redis.on('connect', () => console.log('Redis Client Connected'));
}

export interface UserProfile {
  socketId: string;
  userId: string;
  username: string;
  mode: string;
  interests: string[];
  language?: string;
  country?: string;
  status: 'OFFLINE' | 'ACTIVE' | 'IN_SESSION';
  partnerId?: string;
  roomId?: string;
}

const memoryStore = {
  users: new Map<string, UserProfile>(),
  queues: {
    text: [] as string[],
    video: [] as string[],
    voice: [] as string[]
  }
};

export class Matchmaker {
  static async setUserStatus(socketId: string, profile: Partial<UserProfile>) {
    if (redis && redis.status === 'ready') {
      try {
        const existing = await redis.hget('users', socketId);
        const updated = existing ? { ...JSON.parse(existing), ...profile } : profile;
        await redis.hset('users', socketId, JSON.stringify(updated));
        // Set an expiration so dead users don't clutter Redis forever (e.g., 24 hours)
        await redis.expire('users', 86400);
        return;
      } catch (err) {
        console.error('Redis error in setUserStatus:', err);
      }
    }
    const existing = memoryStore.users.get(socketId) || {} as UserProfile;
    memoryStore.users.set(socketId, { ...existing, ...profile } as UserProfile);
  }

  static async getUser(socketId: string): Promise<UserProfile | null> {
    if (redis && redis.status === 'ready') {
      try {
        const data = await redis.hget('users', socketId);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Redis error in getUser:', err);
      }
    }
    return memoryStore.users.get(socketId) || null;
  }

  static async removeUser(socketId: string) {
    if (redis && redis.status === 'ready') {
      try {
        const userStr = await redis.hget('users', socketId);
        if (userStr) {
          const user = JSON.parse(userStr) as UserProfile;
          if (user.mode) {
            await this.removeFromQueue(socketId, user.mode);
          }
        }
        await redis.hdel('users', socketId);
        return;
      } catch (err) {
        console.error('Redis error in removeUser:', err);
      }
    }
    const user = memoryStore.users.get(socketId);
    if (user && user.mode) {
      this.removeFromQueue(socketId, user.mode);
    }
    memoryStore.users.delete(socketId);
  }

  static async removeFromQueue(socketId: string, mode: string) {
    if (redis && redis.status === 'ready') {
      try {
        await redis.lrem(`queue:${mode}`, 0, socketId);
        return;
      } catch (err) {
        console.error('Redis error in removeFromQueue:', err);
      }
    }
    if (mode in memoryStore.queues) {
      const queueName = mode as keyof typeof memoryStore.queues;
      memoryStore.queues[queueName] = memoryStore.queues[queueName].filter(id => id !== socketId);
    }
  }

  static async addToQueue(socketId: string, mode: string) {
    await this.setUserStatus(socketId, { status: 'ACTIVE', mode });
    if (redis && redis.status === 'ready') {
      try {
        // Remove from queue first to avoid duplicates
        await redis.lrem(`queue:${mode}`, 0, socketId);
        await redis.rpush(`queue:${mode}`, socketId);
        return;
      } catch (err) {
        console.error('Redis error in addToQueue:', err);
      }
    }
    const queue = memoryStore.queues[mode as keyof typeof memoryStore.queues];
    if (!queue.includes(socketId)) {
      queue.push(socketId);
    }
  }

  static async findMatch(mode: string): Promise<[UserProfile, UserProfile] | null> {
    if (redis && redis.status === 'ready') {
      try {
        // Clean up dead/inactive users from the front of the queue
        let user1Id: string | null = null;
        let user1Str: string | null = null;
        
        while (true) {
          user1Id = await redis.lpop(`queue:${mode}`);
          if (!user1Id) return null; // Queue is empty
          
          user1Str = await redis.hget('users', user1Id);
          if (user1Str) {
            const u1 = JSON.parse(user1Str) as UserProfile;
            if (u1.status === 'ACTIVE') {
              break; // Found a valid user1
            }
          }
          // If user is dead or not ACTIVE, loop continues and discards them
        }

        let user2Id: string | null = null;
        let user2Str: string | null = null;
        
        while (true) {
          user2Id = await redis.lpop(`queue:${mode}`);
          if (!user2Id) {
            // No valid user2 found, put user1 back at the front
            await redis.lpush(`queue:${mode}`, user1Id);
            return null;
          }
          
          user2Str = await redis.hget('users', user2Id);
          if (user2Str) {
            const u2 = JSON.parse(user2Str) as UserProfile;
            if (u2.status === 'ACTIVE') {
              break; // Found a valid user2
            }
          }
          // If user is dead or not ACTIVE, loop continues and discards them
        }

        return [JSON.parse(user1Str!), JSON.parse(user2Str!)];
      } catch (err) {
        console.error('Redis error in findMatch:', err);
      }
    }
    
    // In-memory fallback
    const queue = memoryStore.queues[mode as keyof typeof memoryStore.queues];
    
    // Clean up dead/inactive users from the front of the queue
    while (queue.length > 0) {
      const u = memoryStore.users.get(queue[0]);
      if (!u || u.status !== 'ACTIVE') {
        queue.shift();
      } else {
        break;
      }
    }
    
    if (queue.length >= 2) {
      const user1Id = queue.shift()!;
      
      // Clean up dead/inactive users for user2
      while (queue.length > 0) {
        const u = memoryStore.users.get(queue[0]);
        if (!u || u.status !== 'ACTIVE') {
          queue.shift();
        } else {
          break;
        }
      }
      
      if (queue.length > 0) {
        const user2Id = queue.shift()!;
        const user1 = memoryStore.users.get(user1Id)!;
        const user2 = memoryStore.users.get(user2Id)!;
        return [user1, user2];
      } else {
        // Put user1 back if no valid user2 found
        queue.unshift(user1Id);
      }
    }
    return null;
  }
}
