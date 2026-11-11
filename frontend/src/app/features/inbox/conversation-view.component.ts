import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { InboxStore } from '../../core/inbox.store';
import { Conversation, Message, PLATFORM_META } from '../../core/models';
import { formatDayLabel } from '../../core/time';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { PlatformIconComponent } from '../../shared/platform-icon.component';
import { BytesPipe, ClockPipe, FullDatePipe } from '../../shared/time.pipes';
import { EmailMessageComponent } from './email-message.component';

const PAGE_SIZE = 50;

interface DayGroup {
  label: string;
  messages: Message[];
}

@Component({
  selector: 'app-conversation-view',
  imports: [
    RouterLink,
    AvatarComponent,
    IconComponent,
    PlatformIconComponent,
    EmailMessageComponent,
    ClockPipe,
    FullDatePipe,
    BytesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col' },
  template: `
    <header class="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5 sm:px-4 dark:border-slate-800">
      <a
        routerLink="/inbox"
        class="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Back to conversations"
      >
        <app-icon name="back" />
      </a>
      @if (conversation(); as c) {
        <app-avatar [name]="c.title" [platform]="c.platform" size="sm" [badge]="false" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-sm font-semibold">{{ c.title || c.externalId }}</h2>
          <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ subtitle() }}</p>
        </div>
        <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" [class]="meta()?.soft">
          <app-platform-icon [platform]="c.platform" size="size-3.5" [colored]="false" />
          <span class="hidden sm:inline">{{ meta()?.label }}</span>
        </span>
      } @else {
        <div class="h-8 flex-1 animate-pulse rounded bg-slate-100 dark:bg-slate-900"></div>
      }
    </header>

    <div #scroller class="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 dark:bg-slate-950" (scroll)="onScroll()">
      <div class="mx-auto max-w-3xl px-3 py-4 sm:px-6">
        @if (hasMore() && messages().length) {
          <div class="mb-4 text-center">
            <button
              type="button"
              (click)="loadOlder()"
              [disabled]="loadingOlder()"
              class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {{ loadingOlder() ? 'Loading…' : 'Load older messages' }}
            </button>
          </div>
        }

        @if (loading()) {
          <p class="py-16 text-center text-sm text-slate-400">Loading messages…</p>
        } @else if (error()) {
          <p class="py-16 text-center text-sm text-red-600 dark:text-red-400">{{ error() }}</p>
        } @else if (isEmail()) {
          <!-- Email thread: one card per email, newest expanded -->
          @if (conversation()?.title; as subject) {
            <h1 class="mb-4 text-lg font-semibold break-words sm:text-xl">{{ subject }}</h1>
          }
          <div class="space-y-3">
            @for (m of messages(); track m._id; let last = $last) {
              <app-email-message [message]="m" [initiallyExpanded]="last" />
            }
          </div>
        } @else {
          <!-- Chat: bubbles grouped by day -->
          @for (group of groups(); track group.label) {
            <div class="my-4 flex justify-center">
              <span
                class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
              >
                {{ group.label }}
              </span>
            </div>
            <div class="space-y-1.5">
              @for (m of group.messages; track m._id; let i = $index) {
                <div class="flex" [class]="m.direction === 'out' ? 'justify-end' : 'justify-start'">
                  <div
                    class="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]"
                    [class]="
                      m.direction === 'out'
                        ? 'rounded-br-md bg-sky-600 text-white'
                        : 'rounded-bl-md bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'
                    "
                    [title]="m.timestamp | fullDate"
                  >
                    @if (showSender(group.messages, i)) {
                      <p class="mb-0.5 text-xs font-semibold" [class]="meta()?.text">{{ m.from.name || m.from.handle }}</p>
                    }
                    @for (a of m.attachments; track $index) {
                      <p
                        class="mb-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
                        [class]="m.direction === 'out' ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800'"
                      >
                        <app-icon [name]="a.type === 'photo' || a.type === 'image' ? 'image' : 'file'" size="size-3.5" />
                        {{ a.name || a.type }}
                        @if (a.size) {
                          <span class="opacity-70">{{ a.size | bytes }}</span>
                        }
                      </p>
                    }
                    @if (!isPlaceholder(m)) {
                      <p class="whitespace-pre-wrap break-words">{{ m.text }}</p>
                    }
                    <p
                      class="mt-0.5 text-right text-[11px] tabular-nums"
                      [class]="m.direction === 'out' ? 'text-sky-100' : 'text-slate-400'"
                    >
                      {{ m.timestamp | clock }}
                    </p>
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>

    @if (showJump()) {
      <div class="pointer-events-none relative">
        <button
          type="button"
          (click)="scrollToBottom(true)"
          class="pointer-events-auto absolute right-4 bottom-14 flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-slate-900"
        >
          <app-icon name="chevronDown" size="size-3.5" /> New messages
        </button>
      </div>
    }

    <footer
      class="flex items-center justify-center gap-1.5 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-400 dark:border-slate-800"
    >
      <app-icon name="lock" size="size-3.5" /> Read-only. Replies are coming later.
    </footer>
  `,
})
export class ConversationViewComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(InboxStore);
  private readonly injector = inject(Injector);

  /** Route param (`/inbox/:key`), bound via withComponentInputBinding(). */
  readonly key = input.required<string>();

  protected readonly conversation = signal<Conversation | null>(null);
  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showJump = signal(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private loadSeq = 0;

  protected readonly meta = computed(() => {
    const c = this.conversation();
    return c ? PLATFORM_META[c.platform] : null;
  });
  protected readonly isEmail = computed(() => this.conversation()?.platform === 'gmail');

  protected readonly subtitle = computed(() => {
    const c = this.conversation();
    if (!c) return '';
    const label = PLATFORM_META[c.platform].label;
    if (c.platform === 'sms' || c.platform === 'whatsapp') {
      return c.title !== c.externalId ? `${c.externalId} · ${label}` : label;
    }
    if (c.platform === 'gmail') return `${this.messages().length} email${this.messages().length === 1 ? '' : 's'} · ${label}`;
    const lastIn = [...this.messages()].reverse().find((m) => m.direction === 'in');
    const handle = c.type === 'private' ? lastIn?.from.handle : c.type;
    return [handle, label].filter(Boolean).join(' · ');
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const m of this.messages()) {
      const label = formatDayLabel(m.timestamp);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.messages.push(m);
      else groups.push({ label, messages: [m] });
    }
    return groups;
  });

  constructor() {
    // Load whenever the route key changes.
    effect(() => {
      const key = this.key();
      untracked(() => this.open(key));
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.store.activeKey() === this.key()) this.store.activeKey.set(null);
    });

    // Live messages for this conversation.
    this.store.liveMessages$
      .pipe(
        filter((e) => e.message.conversationKey === this.key()),
        takeUntilDestroyed(),
      )
      .subscribe(({ message, conversation }) => {
        if (this.messages().some((m) => m._id === message._id)) return;
        const nearBottom = this.isNearBottom();
        this.messages.update((list) => [...list, message]);
        this.conversation.set(conversation);
        if (nearBottom || message.direction === 'out') this.scrollToBottom();
        else this.showJump.set(true);
      });
  }

  private async open(key: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.store.activeKey.set(key);
    this.loading.set(true);
    this.error.set(null);
    this.showJump.set(false);
    this.messages.set([]);
    this.conversation.set(this.store.find(key) ?? null);

    try {
      const [conversation, { items }] = await Promise.all([
        this.api.conversation(key),
        this.api.messages(key, { limit: PAGE_SIZE }),
      ]);
      if (seq !== this.loadSeq) return;
      this.conversation.set(conversation);
      this.messages.set(items);
      this.hasMore.set(items.length === PAGE_SIZE);
      this.loading.set(false);
      this.scrollToBottom();
      if (conversation.unreadCount > 0) this.store.markRead(key);
    } catch {
      if (seq !== this.loadSeq) return;
      this.error.set('Could not load this conversation.');
      this.loading.set(false);
    }
  }

  protected async loadOlder(): Promise<void> {
    const first = this.messages()[0];
    if (!first || this.loadingOlder()) return;
    const el = this.scroller()?.nativeElement;
    const prevHeight = el?.scrollHeight ?? 0;

    this.loadingOlder.set(true);
    try {
      const { items } = await this.api.messages(this.key(), { before: first.timestamp, limit: PAGE_SIZE });
      const known = new Set(this.messages().map((m) => m._id));
      this.messages.update((list) => [...items.filter((m) => !known.has(m._id)), ...list]);
      this.hasMore.set(items.length === PAGE_SIZE);
      // Keep the viewport anchored on the message the user was looking at.
      afterNextRender(() => el && (el.scrollTop = el.scrollHeight - prevHeight), { injector: this.injector });
    } finally {
      this.loadingOlder.set(false);
    }
  }

  /** Show the sender name on the first incoming message of a run in group chats. */
  protected showSender(list: Message[], i: number): boolean {
    const c = this.conversation();
    if (!c || c.type !== 'group' || list[i].direction === 'out') return false;
    const prev = list[i - 1];
    return !prev || prev.direction === 'out' || prev.from.handle !== list[i].from.handle;
  }

  /** Media-only messages have text like "[photo]"; the attachment chip already shows that. */
  protected isPlaceholder(m: Message): boolean {
    return m.attachments.length > 0 && /^\[[a-z]+\]$/.test(m.text);
  }

  protected onScroll(): void {
    if (this.showJump() && this.isNearBottom()) this.showJump.set(false);
  }

  protected scrollToBottom(smooth = false): void {
    this.showJump.set(false);
    afterNextRender(
      () => {
        const el = this.scroller()?.nativeElement;
        el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      },
      { injector: this.injector },
    );
  }

  private isNearBottom(): boolean {
    const el = this.scroller()?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }
}
