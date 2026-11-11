export type Platform = 'sms' | 'telegram' | 'gmail';
export type PlatformFilter = Platform | 'all';

export const PLATFORMS: Platform[] = ['sms', 'telegram', 'gmail'];

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

export interface UnreadCounts {
  total: number;
  sms: number;
  telegram: number;
  gmail: number;
}

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
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    ring: 'ring-emerald-500/30',
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
