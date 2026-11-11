import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { InboxStore } from '../../core/inbox.store';
import { PLATFORMS, PLATFORM_META, PlatformFilter } from '../../core/models';
import { UiStateService } from '../../core/ui-state.service';
import { IconComponent } from '../../shared/icon.component';
import { PlatformIconComponent } from '../../shared/platform-icon.component';
import { ConversationItemComponent } from './conversation-item.component';

/** Conversation list (left) + selected conversation (right, via child route). */
@Component({
  selector: 'app-inbox-page',
  imports: [RouterOutlet, RouterLink, IconComponent, PlatformIconComponent, ConversationItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full' },
  template: `
    <section
      class="h-full w-full flex-col border-r border-slate-200 md:flex md:w-80 xl:w-96 dark:border-slate-800"
      [class]="store.activeKey() ? 'hidden' : 'flex'"
      aria-label="Conversations"
    >
      <header class="space-y-3 border-b border-slate-200 px-4 pt-4 pb-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="ui.openDrawer()"
            class="-ml-1.5 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <app-icon name="menu" />
          </button>
          <h1 class="text-lg font-semibold">{{ store.title() }}</h1>
          @if (store.unreadOnly()) {
            <span class="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
              Unread
            </span>
          }
          <button
            type="button"
            (click)="store.resync()"
            class="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Refresh"
            title="Refresh"
          >
            <app-icon name="refresh" size="size-4" [class.animate-spin]="store.loading()" />
          </button>
        </div>

        <form (submit)="search($event, q.value)" role="search">
          <label class="relative block">
            <span class="sr-only">Search all messages</span>
            <app-icon name="search" size="size-4" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              #q
              type="search"
              placeholder="Search all messages"
              class="w-full rounded-lg border border-transparent bg-slate-100 py-2 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:bg-slate-900 dark:focus:bg-slate-950"
            />
          </label>
        </form>

        <!-- Platform chips (mobile / tablet; desktop uses the sidebar) -->
        <div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 lg:hidden">
          <button type="button" (click)="store.setPlatform('all')" [class]="chip('all')">All</button>
          @for (p of platforms; track p) {
            <button type="button" (click)="store.setPlatform(p)" [class]="chip(p)">
              <app-platform-icon [platform]="p" size="size-3.5" [colored]="store.platform() !== p" />
              {{ meta[p].label }}
              @if (store.counts()[p]) {
                <span class="tabular-nums opacity-80">{{ store.counts()[p] }}</span>
              }
            </button>
          }
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto" (scroll)="onScroll($event)">
        @if (store.loading() && !store.conversations().length) {
          @for (i of skeleton; track i) {
            <div class="flex animate-pulse items-center gap-3 px-4 py-3">
              <div class="size-11 rounded-full bg-slate-200 dark:bg-slate-800"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800"></div>
                <div class="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-900"></div>
              </div>
            </div>
          }
        } @else if (store.error()) {
          <div class="p-8 text-center text-sm">
            <p class="text-red-600 dark:text-red-400">{{ store.error() }}</p>
            <button type="button" (click)="store.reload()" class="mt-3 font-medium text-sky-600 hover:underline dark:text-sky-400">
              Try again
            </button>
          </div>
        } @else if (!store.conversations().length) {
          <div class="flex flex-col items-center px-8 py-16 text-center">
            <div class="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-900">
              <app-icon name="inbox" size="size-6" />
            </div>
            <p class="font-medium">{{ store.unreadOnly() ? 'All caught up' : 'No messages yet' }}</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              @if (store.unreadOnly()) {
                No unread conversations here.
              } @else {
                Messages show up here as soon as a source is connected.
                <a routerLink="/settings" class="font-medium text-sky-600 hover:underline dark:text-sky-400">Check sources</a>
              }
            </p>
          </div>
        } @else {
          <ul class="divide-y divide-slate-100 dark:divide-slate-900">
            @for (c of store.conversations(); track c.key) {
              <li>
                <app-conversation-item [conversation]="c" [active]="c.key === store.activeKey()" />
              </li>
            }
          </ul>
          @if (store.loadingMore()) {
            <p class="py-4 text-center text-xs text-slate-400">Loading…</p>
          } @else if (!store.hasMore()) {
            <p class="py-6 text-center text-xs text-slate-400">That's everything</p>
          }
        }
      </div>
    </section>

    <main class="h-full min-w-0 flex-1 md:block" [class]="store.activeKey() ? 'block' : 'hidden'">
      <router-outlet />
    </main>
  `,
})
export class InboxPage {
  protected readonly store = inject(InboxStore);
  protected readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  protected readonly platforms = PLATFORMS;
  protected readonly meta = PLATFORM_META;
  protected readonly skeleton = Array.from({ length: 8 }, (_, i) => i);

  protected chip(p: PlatformFilter): string {
    const base = 'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ';
    return (
      base +
      (this.store.platform() === p
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
    );
  }

  protected onScroll(e: Event): void {
    const el = e.target as HTMLElement;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) this.store.loadMore();
  }

  protected search(e: Event, q: string): void {
    e.preventDefault();
    this.router.navigate(['/search'], { queryParams: q.trim() ? { q: q.trim() } : {} });
  }
}
