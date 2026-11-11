import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Message, PLATFORMS, PLATFORM_META, PlatformFilter } from '../../core/models';
import { UiStateService } from '../../core/ui-state.service';
import { IconComponent } from '../../shared/icon.component';
import { PlatformIconComponent } from '../../shared/platform-icon.component';
import { FullDatePipe, ListTimePipe } from '../../shared/time.pipes';
import { Segment, highlight } from './highlight';

interface Result {
  message: Message;
  segments: Segment[];
}

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, IconComponent, PlatformIconComponent, ListTimePipe, FullDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col' },
  template: `
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
        <h1 class="text-lg font-semibold">Search</h1>
      </div>

      <div class="mx-auto max-w-3xl space-y-3">
        <label class="relative block">
          <span class="sr-only">Search messages</span>
          <app-icon name="search" size="size-4" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            #input
            type="search"
            [value]="term()"
            (input)="onInput($any($event.target).value)"
            placeholder="Search SMS, WhatsApp, Telegram and Gmail…"
            class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <div class="flex gap-1.5 overflow-x-auto">
          <button type="button" (click)="setPlatform('all')" [class]="chip('all')">All</button>
          @for (p of platforms; track p) {
            <button type="button" (click)="setPlatform(p)" [class]="chip(p)">
              <app-platform-icon [platform]="p" size="size-3.5" [colored]="platform() !== p" />
              {{ meta[p].label }}
            </button>
          }
        </div>
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl">
        @if (!term().trim()) {
          <p class="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Type to search across every message. Matches whole words, e.g. <em>invoice</em> or <em>otp</em>.
          </p>
        } @else if (loading()) {
          <p class="px-6 py-16 text-center text-sm text-slate-400">Searching…</p>
        } @else if (error()) {
          <p class="px-6 py-16 text-center text-sm text-red-600 dark:text-red-400">{{ error() }}</p>
        } @else if (!results().length) {
          <p class="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">No messages match "{{ term() }}".</p>
        } @else {
          <p class="px-4 pt-3 pb-1 text-xs text-slate-400">{{ results().length }}{{ results().length === 50 ? '+' : '' }} result{{ results().length === 1 ? '' : 's' }}</p>
          <ul class="divide-y divide-slate-100 dark:divide-slate-900">
            @for (r of results(); track r.message._id) {
              <li>
                <a
                  [routerLink]="['/inbox', r.message.conversationKey]"
                  class="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <app-platform-icon [platform]="r.message.platform" size="size-4" class="mt-0.5" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                      <span class="truncate text-sm font-medium">
                        {{ r.message.direction === 'out' ? 'You' : r.message.from.name || r.message.from.handle }}
                      </span>
                      <span class="ml-auto shrink-0 text-xs text-slate-400" [title]="r.message.timestamp | fullDate">
                        {{ r.message.timestamp | listTime }}
                      </span>
                    </div>
                    @if (r.message.subject) {
                      <p class="truncate text-sm text-slate-700 dark:text-slate-300">{{ r.message.subject }}</p>
                    }
                    <p class="mt-0.5 line-clamp-2 text-sm break-words text-slate-500 dark:text-slate-400">
                      @for (s of r.segments; track $index) {
                        @if (s.match) {
                          <mark>{{ s.text }}</mark>
                        } @else {
                          {{ s.text }}
                        }
                      }
                    </p>
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class SearchPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly ui = inject(UiStateService);

  /** `?q=` query param, bound via withComponentInputBinding(). */
  readonly q = input<string | undefined>();

  protected readonly platforms = PLATFORMS;
  protected readonly meta = PLATFORM_META;
  protected readonly term = signal('');
  protected readonly platform = signal<PlatformFilter>('all');
  protected readonly results = signal<Result[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    effect(() => {
      const q = this.q() ?? '';
      untracked(() => {
        if (q !== this.term()) {
          this.term.set(q);
          this.run();
        }
      });
    });
    afterNextRender(() => this.inputEl()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.debounce && clearTimeout(this.debounce));
  }

  protected onInput(value: string): void {
    this.term.set(value);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      // Keep the URL shareable/back-button friendly without adding history entries per keystroke.
      this.router.navigate([], { queryParams: { q: value.trim() || null }, replaceUrl: true });
      this.run();
    }, 300);
  }

  protected setPlatform(p: PlatformFilter): void {
    this.platform.set(p);
    this.run();
  }

  protected chip(p: PlatformFilter): string {
    return (
      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ' +
      (this.platform() === p
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
    );
  }

  private async run(): Promise<void> {
    const q = this.term().trim();
    const seq = ++this.seq;
    if (!q) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = this.platform();
      const { items } = await this.api.search({ q, platform: p === 'all' ? undefined : p, limit: 50 });
      if (seq !== this.seq) return;
      this.results.set(items.map((message) => ({ message, segments: highlight(message.text, q) })));
    } catch {
      if (seq === this.seq) this.error.set('Search failed. Is the server running?');
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
}
