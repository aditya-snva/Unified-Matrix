import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { InboxStore } from '../../core/inbox.store';
import { PLATFORMS, PLATFORM_META, Platform } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { UiStateService } from '../../core/ui-state.service';
import { IconComponent, IconName } from '../../shared/icon.component';
import { PlatformIconComponent } from '../../shared/platform-icon.component';
import { STATE_LABELS, StatusDotComponent } from '../../shared/status-dot.component';
import { AgoPipe, FullDatePipe } from '../../shared/time.pipes';

const HELP: Record<Platform, string> = {
  telegram: 'Set TELEGRAM_API_ID / TELEGRAM_API_HASH in backend .env, run "npm run telegram:login", paste TELEGRAM_SESSION, restart.',
  gmail: 'Set GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in backend .env, run "npm run gmail:auth", paste GMAIL_REFRESH_TOKEN, restart.',
  sms: 'Set SMS_WEBHOOK_TOKEN in backend .env, then point your Android forwarder at the webhook URL below.',
};

@Component({
  selector: 'app-settings-page',
  imports: [IconComponent, PlatformIconComponent, StatusDotComponent, AgoPipe, FullDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col' },
  template: `
    <header class="flex items-center gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
      <button
        type="button"
        (click)="ui.openDrawer()"
        class="-ml-1.5 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Open menu"
      >
        <app-icon name="menu" />
      </button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <!-- Sources -->
        <section>
          <div class="mb-3 flex items-center">
            <h2 class="text-sm font-semibold">Sources</h2>
            <button
              type="button"
              (click)="store.refreshStatus()"
              class="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <app-icon name="refresh" size="size-3.5" /> Refresh
            </button>
          </div>
          <div class="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            @for (p of platforms; track p) {
              @let s = store.statuses()[p];
              <div class="p-4">
                <div class="flex items-center gap-3">
                  <span class="flex size-9 items-center justify-center rounded-lg" [class]="meta[p].soft">
                    <app-platform-icon [platform]="p" size="size-5" [colored]="false" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium">{{ meta[p].label }}</p>
                    <p class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <app-status-dot [state]="s?.state" />
                      {{ s ? labels[s.state] : 'Unknown' }}
                      @if (p === 'sms' && s?.state === 'connected') {
                        · phone last seen {{ s?.lastSeenAt | ago }}
                      } @else if (s?.updatedAt) {
                        · since <span [title]="s!.updatedAt | fullDate">{{ s!.updatedAt | ago }}</span>
                      }
                    </p>
                  </div>
                </div>
                @if (s?.error) {
                  <p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {{ s!.error }}
                  </p>
                }
                @if (!s || s.state === 'not_configured') {
                  <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">{{ help[p] }}</p>
                }
                @if (p === 'sms') {
                  <div class="mt-3">
                    <p class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Webhook URL for the phone app</p>
                    <div class="flex items-center gap-2">
                      <code class="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-900">{{ webhookUrl }}</code>
                      <button
                        type="button"
                        (click)="copy()"
                        class="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <app-icon [name]="copied() ? 'check' : 'copy'" size="size-3.5" />
                        {{ copied() ? 'Copied' : 'Copy' }}
                      </button>
                    </div>
                    <p class="mt-1.5 text-xs text-slate-400">Header: Authorization: Bearer &lt;SMS_WEBHOOK_TOKEN&gt;</p>
                  </div>
                }
              </div>
            }
          </div>
        </section>

        <!-- Appearance -->
        <section>
          <h2 class="mb-3 text-sm font-semibold">Appearance</h2>
          <div class="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900" role="radiogroup" aria-label="Theme">
            @for (t of themes; track t.mode) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="theme.mode() === t.mode"
                (click)="theme.set(t.mode)"
                class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition"
                [class]="
                  theme.mode() === t.mode
                    ? 'bg-white font-medium shadow-sm dark:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                "
              >
                <app-icon [name]="t.icon" size="size-4" /> {{ t.label }}
              </button>
            }
          </div>
        </section>

        <!-- Notifications -->
        <section>
          <h2 class="mb-3 text-sm font-semibold">Notifications</h2>
          <div class="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <app-icon name="bell" class="mt-0.5 text-slate-400" />
            <div class="flex-1">
              <p class="text-sm font-medium">New message alerts</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                @if (!notifications.supported) {
                  This browser doesn't support notifications.
                } @else if (notifications.permission() === 'denied') {
                  Blocked in browser settings. Allow notifications for this site to turn them on.
                } @else {
                  Shown when the app is open in the background.
                }
              </p>
            </div>
            <button
              type="button"
              role="switch"
              [attr.aria-checked]="notifications.enabled()"
              aria-label="New message alerts"
              [disabled]="!notifications.supported || notifications.permission() === 'denied'"
              (click)="toggleNotifications()"
              class="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40"
              [class]="notifications.enabled() ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'"
            >
              <span
                class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition"
                [class.translate-x-5]="notifications.enabled()"
              ></span>
            </button>
          </div>
        </section>

        <!-- Account -->
        <section>
          <h2 class="mb-3 text-sm font-semibold">Account</h2>
          <button
            type="button"
            (click)="auth.logout()"
            class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-slate-800 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <app-icon name="logout" size="size-4" /> Log out
          </button>
        </section>
      </div>
    </div>
  `,
})
export class SettingsPage {
  protected readonly store = inject(InboxStore);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiStateService);

  protected readonly platforms = PLATFORMS;
  protected readonly meta = PLATFORM_META;
  protected readonly labels = STATE_LABELS;
  protected readonly help = HELP;
  protected readonly copied = signal(false);
  protected readonly webhookUrl = `${environment.apiUrl || window.location.origin}/webhooks/sms`;
  protected readonly themes: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'system', label: 'System', icon: 'monitor' },
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];

  constructor() {
    this.store.refreshStatus();
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.webhookUrl);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  protected toggleNotifications(): void {
    if (this.notifications.enabled()) this.notifications.disable();
    else this.notifications.enable();
  }
}
