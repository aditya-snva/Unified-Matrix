import { EventEmitter } from 'node:events';

// In-process event bus: core emits, the realtime layer listens.
// Events:
//   'message:new'          { message, conversation }
//   'conversation:updated' { conversation }
//   'connector:status'     { name, state, error, updatedAt }
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);
