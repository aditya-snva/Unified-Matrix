import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  await mongoose.connect(env.mongoUri);
  // Wait until all indexes (unique dedupe index, text search index) exist before serving requests.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  console.log('MongoDB connected');
}
