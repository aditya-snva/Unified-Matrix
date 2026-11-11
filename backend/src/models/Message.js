import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    type: String, // photo, video, document, audio, file ...
    name: String,
    mimeType: String,
    size: Number,
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: ['sms', 'telegram', 'gmail'], required: true },
    externalId: { type: String, required: true }, // platform's own message id
    conversationKey: { type: String, required: true }, // `${platform}:${externalConversationId}`
    from: {
      name: String,
      handle: String, // phone number, @username, email address
    },
    direction: { type: String, enum: ['in', 'out'], default: 'in' },
    subject: String, // gmail only
    text: { type: String, default: '' },
    html: String, // gmail only
    attachments: { type: [attachmentSchema], default: [] },
    timestamp: { type: Date, required: true },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed }, // small platform-specific extras
  },
  { timestamps: true },
);

// Dedupe: the same platform message can never be stored twice.
messageSchema.index({ platform: 1, externalId: 1 }, { unique: true });
messageSchema.index({ conversationKey: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });
messageSchema.index({ text: 'text', subject: 'text', 'from.name': 'text', 'from.handle': 'text' });

export const Message = mongoose.model('Message', messageSchema);
