import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../core/api.service';
import { Message } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { BytesPipe, FullDatePipe, ListTimePipe } from '../../shared/time.pipes';

/**
 * Wraps untrusted email HTML for the sandboxed iframe:
 * - CSP blocks all scripts, forms and plugins (the sandbox already does too; this is a second layer)
 * - links open in a new tab
 */
function wrapEmailHtml(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'">
<base target="_blank">
<style>
  html,body{margin:0;background:#fff;color:#0f172a}
  body{padding:16px;font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;overflow-wrap:anywhere}
  img{max-width:100%;height:auto}
  table{max-width:100%}
  pre{white-space:pre-wrap}
</style></head><body>${html}</body></html>`;
}

@Component({
  selector: 'app-email-message',
  imports: [IconComponent, BytesPipe, FullDatePipe, ListTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        (click)="expanded.set(!expanded())"
        class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
        [attr.aria-expanded]="expanded()"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="truncate text-sm font-semibold">
              {{ message().direction === 'out' ? 'You' : message().from.name || message().from.handle }}
            </span>
            @if (message().from.handle && message().from.handle !== message().from.name && message().direction === 'in') {
              <span class="hidden truncate text-xs text-slate-400 sm:inline">&lt;{{ message().from.handle }}&gt;</span>
            }
            <span class="ml-auto shrink-0 text-xs text-slate-400" [title]="message().timestamp | fullDate">
              {{ message().timestamp | listTime }}
            </span>
          </div>
          @if (expanded()) {
            @if (to()) {
              <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">to {{ to() }}</p>
            }
          } @else {
            <p class="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{{ message().text }}</p>
          }
        </div>
      </button>

      @if (expanded()) {
        <div class="border-t border-slate-100 dark:border-slate-800">
          @if (hasHtml()) {
            <div class="flex justify-end gap-1 px-4 pt-2">
              <button type="button" (click)="mode.set('html')" [class]="tab('html')">HTML</button>
              <button type="button" (click)="mode.set('text')" [class]="tab('text')">Text</button>
            </div>
          }

          @if (mode() === 'html' && hasHtml()) {
            @if (srcdoc(); as doc) {
              <div class="p-2">
                <iframe
                  #frame
                  title="Email content"
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  referrerpolicy="no-referrer"
                  [srcdoc]="doc"
                  (load)="onFrameLoad()"
                  class="block h-40 w-full rounded-lg bg-white"
                ></iframe>
              </div>
            } @else {
              <p class="px-4 py-6 text-sm text-slate-400">{{ loadError() || 'Loading email…' }}</p>
            }
          } @else {
            <div class="px-4 py-3 text-sm whitespace-pre-wrap break-words">{{ message().text }}</div>
          }

          @if (message().attachments.length) {
            <div class="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              @for (a of message().attachments; track $index) {
                <span
                  class="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs dark:bg-slate-800"
                >
                  <app-icon [name]="a.type === 'image' ? 'image' : 'paperclip'" size="size-3.5" />
                  <span class="truncate">{{ a.name || a.type }}</span>
                  @if (a.size) {
                    <span class="text-slate-400">{{ a.size | bytes }}</span>
                  }
                </span>
              }
            </div>
          }
        </div>
      }
    </article>
  `,
})
export class EmailMessageComponent {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly message = input.required<Message>();
  readonly initiallyExpanded = input(false);

  protected readonly expanded = signal(false);
  protected readonly mode = signal<'html' | 'text'>('html');
  protected readonly html = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private resizeObserver?: ResizeObserver;

  protected readonly hasHtml = computed(() => Boolean(this.message().html || this.message().hasHtml));
  protected readonly to = computed(() => {
    const to = this.message().meta?.['to'];
    return typeof to === 'string' ? to : '';
  });

  /** The iframe is sandboxed without allow-scripts, so trusting the HTML for srcdoc is safe. */
  protected readonly srcdoc = computed<SafeHtml | null>(() => {
    const html = this.html();
    return html ? this.sanitizer.bypassSecurityTrustHtml(wrapEmailHtml(html)) : null;
  });

  constructor() {
    effect(() => this.expanded.set(this.initiallyExpanded()));

    // Load the HTML body on first expand (live pushes don't include it).
    effect(() => {
      const m = this.message();
      if (!this.expanded() || !this.hasHtml() || this.html()) return;
      if (m.html) {
        this.html.set(m.html);
        return;
      }
      this.api
        .message(m._id)
        .then((full) => (full.html ? this.html.set(full.html) : this.mode.set('text')))
        .catch(() => this.loadError.set('Could not load this email.'));
    });

    inject(DestroyRef).onDestroy(() => this.resizeObserver?.disconnect());
  }

  protected tab(m: 'html' | 'text'): string {
    return (
      'rounded-md px-2 py-0.5 text-xs font-medium ' +
      (this.mode() === m
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
    );
  }

  /** Grow the iframe to fit its content (and keep fitting as images load). */
  protected onFrameLoad(): void {
    const iframe = this.frame()?.nativeElement;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    let last = 0;
    const fit = () => {
      const h = doc.documentElement.scrollHeight + 4;
      if (Math.abs(h - last) > 1) iframe.style.height = `${(last = h)}px`;
    };
    fit();
    this.resizeObserver?.disconnect();
    // Resize in the next frame to avoid "ResizeObserver loop" warnings.
    this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(fit));
    this.resizeObserver.observe(doc.body);
  }
}
