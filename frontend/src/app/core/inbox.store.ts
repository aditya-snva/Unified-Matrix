import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import {
  ConnectorStatuses,
  Conversation,
  LiveMessageEvent,
  PLATFORM_META,
  PlatformFilter,
  UnreadCounts,
} from './models';
import { NotificationService } from './notification.service';
import { SocketService } from './socket.service';

const PAGE_SIZE = 30;
const EMPTY_COUNTS: UnreadCounts = { total: 0, sms: 0, whatsapp: 0, telegram: 0, gmail: 0 };

/**
 * Single source of truth for the inbox: conversation list, filters, unread counts,
 * connector statuses and live updates from Socket.IO.
 */
@Injectable({ providedIn: 'root' })
export class InboxStore {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(SocketService);
  private readonly notifications = inject(NotificationService);

  readonly conversations = signal<Conversation[]>([]);
  readonly platform = signal<PlatformFilter>('all');
  readonly unreadOnly = signal(false);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly error = signal<string | null>(null);
  readonly counts = signal<UnreadCounts>(EMPTY_COUNTS);
  readonly statuses = signal<ConnectorStatuses>({});
  /** Conversation currently open in the message view. */
  readonly activeKey = signal<string | null>(null);

  readonly socketState = this.socket.state;
  readonly liveMessages$ = this.socket.message$;
  readonly title = computed(() => {
    const p = this.platform();
    return p === 'all' ? 'All messages' : PLATFORM_META[p].label;
  });

  private subs: Subscription[] = [];
  private started = false;
  private countsTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;

  constructor() {
    // Unread count in the browser tab title.
    effect(() => {
      const total = this.counts().total;
      document.title = total ? `(${total}) Unified Matrix` : 'Unified Matrix';
    });

    // Opening the app again marks the open conversation as read.
    const onVisible = () => {
      const key = this.activeKey();
      if (document.visibilityState === 'visible' && key && this.find(key)?.unreadCount) this.markRead(key);
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  /** Connect the socket and load initial data. Safe to call repeatedly. */
  start(): void {
    const token = this.auth.token();
    if (this.started || !token) return;
    this.started = true;

    this.subs = [
      this.socket.message$.subscribe((e) => this.onLiveMessage(e)),
      this.socket.conversationUpdated$.subscribe(({ conversation }) => this.replace(conversation)),
      this.socket.connectors$.subscribe((s) => this.statuses.update((cur) => ({ ...cur, ...s }))),
      this.socket.connectorStatus$.subscribe((s) => this.statuses.update((cur) => ({ ...cur, [s.name]: s }))),
      this.socket.reconnected$.subscribe(() => this.resync()),
      this.socket.unauthorized$.subscribe(() => this.auth.logout()),
    ];
    this.socket.connect(token);
    this.resync();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    this.socket.disconnect();
    this.conversations.set([]);
    this.counts.set(EMPTY_COUNTS);
    this.statuses.set({});
    this.activeKey.set(null);
  }

  /** Reload everything (initial load and after a reconnect, to catch up on missed events). */
  resync(): void {
    this.reload();
    this.refreshCounts();
    this.refreshStatus();
  }

  setPlatform(platform: PlatformFilter): void {
    if (this.platform() === platform) return;
    this.platform.set(platform);
    this.reload();
  }

  setUnreadOnly(value: boolean): void {
    if (this.unreadOnly() === value) return;
    this.unreadOnly.set(value);
    this.reload();
  }

  async reload(): Promise<void> {
    const seq = ++this.loadSeq; // ignore responses from outdated filter changes
    this.loading.set(true);
    this.error.set(null);
    try {
      const { items } = await this.api.conversations(this.query());
      if (seq !== this.loadSeq) return;
      this.conversations.set(items);
      this.hasMore.set(items.length === PAGE_SIZE);
    } catch {
      if (seq === this.loadSeq) this.error.set('Could not load conversations. Is the server running?');
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const list = this.conversations();
    const last = list[list.length - 1];
    if (this.loading() || this.loadingMore() || !this.hasMore() || !last?.lastMessageAt) return;

    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const { items } = await this.api.conversations({ ...this.query(), before: last.lastMessageAt });
      if (seq !== this.loadSeq) return;
      const known = new Set(this.conversations().map((c) => c.key));
      this.conversations.update((cur) => [...cur, ...items.filter((c) => !known.has(c.key))]);
      this.hasMore.set(items.length === PAGE_SIZE);
    } catch {
      /* keep current list; user can scroll again */
    } finally {
      this.loadingMore.set(false);
    }
  }

  find(key: string): Conversation | undefined {
    return this.conversations().find((c) => c.key === key);
  }

  async markRead(key: string): Promise<void> {
    const c = this.find(key);
    if (c) this.replace({ ...c, unreadCount: 0 }); // optimistic
    try {
      const updated = await this.api.markRead(key);
      this.replace(updated);
    } catch {
      /* server will correct on next resync */
    }
    this.refreshCounts();
  }

  async refreshStatus(): Promise<void> {
    try {
      this.statuses.set(await this.api.status());
    } catch {
      /* ignore */
    }
  }

  private query() {
    const p = this.platform();
    return { platform: p === 'all' ? undefined : p, unread: this.unreadOnly(), limit: PAGE_SIZE };
  }

  private matchesFilter(c: Conversation): boolean {
    const p = this.platform();
    if (p !== 'all' && c.platform !== p) return false;
    if (this.unreadOnly() && c.unreadCount === 0 && c.key !== this.activeKey()) return false;
    return true;
  }

  /** Update a conversation in place (keeps its position). */
  private replace(conversation: Conversation): void {
    this.conversations.update((list) => list.map((c) => (c.key === conversation.key ? conversation : c)));
  }

  private onLiveMessage({ message, conversation }: LiveMessageEvent): void {
    const isActive = this.activeKey() === conversation.key;
    const visible = document.visibilityState === 'visible';

    // Move the conversation to the top of the list.
    this.conversations.update((list) => {
      const rest = list.filter((c) => c.key !== conversation.key);
      return this.matchesFilter(conversation) ? [conversation, ...rest] : rest;
    });

    if (message.direction === 'in') {
      if (isActive && visible) this.markRead(conversation.key);

      const sender = message.from?.name || message.from?.handle || 'New message';
      const title = conversation.type === 'group' && conversation.title ? `${sender} · ${conversation.title}` : sender;
      const body = message.subject ? `${message.subject}\n${message.text}` : message.text;
      this.notifications.show(
        `${title} (${PLATFORM_META[message.platform].label})`,
        body.slice(0, 200),
        conversation.key,
        `/inbox/${conversation.key}`,
      );
    }

    this.scheduleCounts();
  }

  private scheduleCounts(): void {
    if (this.countsTimer) clearTimeout(this.countsTimer);
    this.countsTimer = setTimeout(() => this.refreshCounts(), 300);
  }

  private async refreshCounts(): Promise<void> {
    try {
      this.counts.set(await this.api.unreadCounts());
    } catch {
      /* ignore */
    }
  }
}
