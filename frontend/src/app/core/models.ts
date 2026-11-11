export type Platform = 'sms' | 'whatsapp' | 'telegram' | 'gmail';
export type PlatformFilter = Platform | 'all';

export const PLATFORMS: Platform[] = ['sms', 'whatsapp', 'telegram', 'gmail'];

/** Platforms that push to us via webhook (status shows "last seen" instead of a live connection). */
export const WEBHOOK_PLATFORMS: Platform[] = ['sms', 'whatsapp'];

export interface Attachment {
  type: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  _id: string;
  platform: Platform;
  externalId: string;
  conversationKey: string;
  from: { name?: string; handle?: string };
  direction: 'in' | 'out';
  subject?: string;
  text: string;
  html?: string;
  /** Set on live socket pushes, where the HTML body is stripped to keep payloads small. */
  hasHtml?: boolean;
  attachments: Attachment[];
  timestamp: string;
  read: boolean;
  meta?: Record<string, unknown>;
}

export interface Conversation {
  _id: string;
  key: string;
  platform: Platform;
  externalId: string;
  title?: string;
  type: string;
  lastMessage?: { text?: string; fromName?: string; direction?: string; timestamp?: string };
  lastMessageAt?: string;
  unreadCount: number;
}

export type ConnectorState = 'not_configured' | 'starting' | 'connected' | 'error' | 'stopped';

export interface ConnectorStatus {
  name: string;
  state: ConnectorState;
  error: string | null;
  updatedAt: string;
  lastSeenAt?: string | null;
}

export type ConnectorStatuses = Partial<Record<Platform, ConnectorStatus>>;

export type UnreadCounts = { total: number } & Record<Platform, number>;

export interface LiveMessageEvent {
  message: Message;
  conversation: Conversation;
}

/** Display metadata per platform. Class names are full literals so Tailwind can detect them. */
export const PLATFORM_META: Record<
  Platform,
  { label: string; text: string; bg: string; soft: string; ring: string }
> = {
  sms: {
    label: 'SMS',
    text: 'text-sms',
    bg: 'bg-sms',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    ring: 'ring-violet-500/30',
  },
  whatsapp: {
    label: 'WhatsApp',
    text: 'text-whatsapp',
    bg: 'bg-whatsapp',
    soft: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    ring: 'ring-green-500/30',
  },
  telegram: {
    label: 'Telegram',
    text: 'text-telegram',
    bg: 'bg-telegram',
    soft: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    ring: 'ring-sky-500/30',
  },
  gmail: {
    label: 'Gmail',
    text: 'text-gmail',
    bg: 'bg-gmail',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    ring: 'ring-rose-500/30',
  },
};
