import mongoose from 'mongoose';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and serverless invocations.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memoryServer?: any;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jaago';
    const isRemote = uri.includes('mongodb+srv://') || (!uri.includes('127.0.0.1') && !uri.includes('localhost'));
    const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

    cached.promise = (async () => {
      try {
        // Use 15s timeout for remote cloud clusters (Atlas) to allow DNS/TLS handshake; 3s for local fail-fast
        const conn = await mongoose.connect(uri, {
          ...opts,
          serverSelectionTimeoutMS: isRemote ? 15000 : 3000,
        });
        console.log(`[MongoDB] Connected successfully to database "${conn.connection.db?.databaseName}" at ${sanitizedUri}`);
        return conn;
      } catch (err) {
        if (process.env.NODE_ENV === 'production' || isRemote) {
          console.error(`[MongoDB] Connection to primary database (${sanitizedUri}) failed:`, err);
          throw err;
        }

        console.warn(`[MongoDB] Local connection to ${sanitizedUri} failed. Attempting MongoDB Memory Server fallback for development/test environment...`);
        try {
          const { MongoMemoryReplSet } = await import('mongodb-memory-server');
          if (!cached.memoryServer) {
            cached.memoryServer = await MongoMemoryReplSet.create({
              replSet: { count: 1, storageEngine: 'wiredTiger', dbName: 'jaago' },
            });
          }
          const memUri = cached.memoryServer.getUri();
          process.env.MONGODB_URI = memUri;
          console.log(`[MongoDB] Started MongoMemoryReplSet at ${memUri}`);
          const conn = await mongoose.connect(memUri, opts);
          return conn;
        } catch (memErr) {
          console.error('[MongoDB] Failed to start in-memory database:', memErr);
          throw err;
        }
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
