import mongoose from 'mongoose';
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load from root .env file if MONGODB_URI is not set
if (!process.env.MONGODB_URI) {
  config({ path: resolve(process.cwd(), '../.env') });
  // Also try current directory
  if (!process.env.MONGODB_URI) {
    config({ path: resolve(process.cwd(), '.env') });
  }
}

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env file');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
