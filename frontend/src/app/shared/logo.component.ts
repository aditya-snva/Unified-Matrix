import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg viewBox="0 0 32 32" [attr.class]="size()" aria-hidden="true">
      <rect width="32" height="32" rx="8" class="fill-slate-900 dark:fill-slate-800" />
      <rect x="6" y="6" width="9" height="9" rx="2.5" class="fill-sms" />
      <rect x="17" y="6" width="9" height="9" rx="2.5" class="fill-telegram" />
      <rect x="6" y="17" width="9" height="9" rx="2.5" class="fill-gmail" />
      <rect x="17" y="17" width="9" height="9" rx="2.5" class="fill-slate-50" />
    </svg>
  `,
})
export class LogoComponent {
  readonly size = input('size-8');
}
