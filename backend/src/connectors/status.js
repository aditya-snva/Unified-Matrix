import { eventBus } from '../core/eventBus.js';

// Live status of each connector, exposed via GET /api/status and Socket.IO.
// state: 'not_configured' | 'starting' | 'connected' | 'error' | 'stopped'
const statuses = new Map();

function publish(status) {
  statuses.set(status.name, status);
  eventBus.emit('connector:status', status);
  return status;
}

export function setStatus(name, state, error = null) {
  const prev = statuses.get(name);
  return publish({
    ...prev, // keep extra fields such as sms.lastSeenAt
    name,
    state,
    error: error ? String(error.message || error) : null,
    updatedAt: new Date(),
  });
}

/** Merge extra fields (e.g. { lastSeenAt }) into a connector's status and push it live. */
export function patchStatus(name, patch) {
  const prev = statuses.get(name) || { name, state: 'connected', error: null, updatedAt: new Date() };
  return publish({ ...prev, ...patch, name });
}

export function getStatuses() {
  return Object.fromEntries(statuses);
}
