import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, interval, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { InboxStore } from '../../core/inbox.store';
import { PLATFORMS, PLATFORM_META, Platform, PlatformFilter, WEBHOOK_PLATFORMS } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { UiStateService } from '../../core/ui-state.service';
import { IconComponent } from '../../shared/icon.component';
import { LogoComponent } from '../../shared/logo.component';
import { PlatformIconComponent } from '../../shared/platform-icon.component';
import { STATE_LABELS, StatusDotComponent } from '../../shared/status-dot.component';
import { AgoPipe } from '../../shared/time.pipes';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent, PlatformIconComponent, StatusDotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full w-64 flex-col bg-slate-50 dark:bg-slate-900' },
  template: `
    <div class="flex items-center gap-2.5 px-4 pt-5 pb-4">
      <app-logo size="size-8" />
      <span class="font-semibold tracking-tight">Unified Matrix</span>
      <button
        type="button"
        (click)="ui.closeDrawer()"
        class="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-200 lg:hidden dark:hover:bg-slate-800"
        aria-label="Close menu"
      >
        <app-icon name="x" />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-2" aria-label="Sources">
      <p class="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Inbox</p>

      <button type="button" (click)="select('all')" [class]="itemClass('all')">
        <app-icon name="inbox" size="size-4" />
        <span class="flex-1 text-left">All messages</span>
        @if (store.counts().total) {
          <span class="text-xs font-semibold tabular-nums">{{ store.counts().total }}</span>
        }
      </button>

      @for (p of platforms; track p) {
        <button type="button" (click)="select(p)" [class]="itemClass(p)">
          <app-platform-icon [platform]="p" size="size-4" />
          <span class="flex-1 text-left">{{ meta[p].label }}</span>
          @if (store.counts()[p]) {
            <span class="text-xs font-semibold tabular-nums">{{ store.counts()[p] }}</span>
          }
        </button>
      }

      <label
        class="mt-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <input
          type="checkbox"
          class="peer sr-only"
          [checked]="store.unreadOnly()"
          (change)="toggleUnread($event)"
        />
        <span
          class="relative h-4 w-7 rounded-full bg-slate-300 transition peer-checked:bg-sky-600 peer-focus-visible:outline-2 peer-focus-visible:outline-sky-500 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3 dark:bg-slate-600"
        ></span>
        Unread only
      </label>

      <p class="px-3 pt-6 pb-1 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Sources
      </p>
      @for (p of platforms; track p) {
        <a
          routerLink="/settings"
          (click)="ui.closeDrawer()"
          class="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
          [title]="store.statuses()[p]?.error || ''"
        >
          <app-status-dot [state]="store.statuses()[p]?.state" />
          <span class="flex-1">{{ meta[p].label }}</span>
          <span class="text-xs text-slate-400">{{ statusText(p) }}</span>
        </a>
      }
    </nav>

    <div class="space-y-0.5 border-t border-slate-200 p-2 dark:border-slate-800">
      <a routerLink="/search" routerLinkActive="bg-slate-200/70 dark:bg-slate-800" (click)="ui.closeDrawer()" [class]="footerItem">
        <app-icon name="search" size="size-4" /> Search
      </a>
      <a
        routerLink="/settings"
        routerLinkActive="bg-slate-200/70 dark:bg-slate-800"
        (click)="ui.closeDrawer()"
        [class]="footerItem"
      >
        <app-icon name="settings" size="size-4" /> Settings
      </a>
      <button type="button" (click)="theme.cycle()" [class]="footerItem" [title]="'Theme: ' + theme.mode()">
        <app-icon [name]="themeIcon()" size="size-4" />
        <span class="capitalize">{{ theme.mode() }} theme</span>
      </button>
      <button type="button" (click)="auth.logout()" [class]="footerItem">
        <app-icon name="logout" size="size-4" /> Log out
      </button>
    </div>
  `,
})
export class SidebarComponent {
  protected readonly store = inject(InboxStore);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  protected readonly platforms = PLATFORMS;
  protected readonly meta = PLATFORM_META;
  protected readonly footerItem =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800';

  protected readonly themeIcon = computed(() =>
    this.theme.mode() === 'dark' ? 'moon' : this.theme.mode() === 'light' ? 'sun' : 'monitor',
  );

  private readonly ago = new AgoPipe();

  /** Current URL as a signal so the active item updates on navigation (OnPush). */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Ticks every 30s so "last seen 2m ago" stays current. */
  private readonly now = toSignal(interval(30_000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  protected itemClass(p: PlatformFilter): string {
    const active = this.store.platform() === p && this.url().startsWith('/inbox');
    return (
      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ' +
      (active
        ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
        : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800')
    );
  }

  protected statusText(p: Platform): string {
    const s = this.store.statuses()[p];
    this.now(); // re-evaluate on tick
    if (!s) return '';
    if (WEBHOOK_PLATFORMS.includes(p) && s.state === 'connected') {
      return s.lastSeenAt ? this.ago.transform(s.lastSeenAt) : 'waiting';
    }
    return s.state === 'connected' ? '' : STATE_LABELS[s.state];
  }

  protected select(p: PlatformFilter): void {
    this.store.setPlatform(p);
    this.ui.closeDrawer();
    this.router.navigate(['/inbox']);
  }

  protected toggleUnread(e: Event): void {
    this.store.setUnreadOnly((e.target as HTMLInputElement).checked);
  }
}
