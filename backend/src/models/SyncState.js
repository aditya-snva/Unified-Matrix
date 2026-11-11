import mongoose from 'mongoose';

// Key/value store for connector checkpoints (e.g. Gmail historyId).
const syncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const SyncState = mongoose.model('SyncState', syncStateSchema);

export async function getState(key) {
  const doc = await SyncState.findOne({ key }).lean();
  return doc?.value;
}

export async function setState(key, value) {
  await SyncState.updateOne({ key }, { $set: { value } }, { upsert: true });
}
