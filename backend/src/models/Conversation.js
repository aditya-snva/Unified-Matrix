import mongoose from 'mongoose';
import { PLATFORMS } from '../core/platforms.js';

const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // `${platform}:${externalId}`
    platform: { type: String, enum: PLATFORMS, required: true },
    externalId: { type: String, required: true },
    title: String,
    type: { type: String, default: 'private' }, // private | group | channel | email | sms
    lastMessage: {
      text: String,
      fromName: String,
      direction: String,
      timestamp: Date,
    },
    lastMessageAt: Date,
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ platform: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
