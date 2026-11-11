import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LogoComponent } from '../../shared/logo.component';

@Component({
  selector: 'app-empty-state',
  imports: [LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col items-center justify-center bg-slate-50/60 p-8 text-center dark:bg-slate-950' },
  template: `
    <app-logo size="size-14" class="opacity-90" />
    <h2 class="mt-4 text-lg font-semibold">Pick a conversation</h2>
    <p class="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
      Messages from SMS, Telegram and Gmail arrive here in real time.
    </p>
  `,
})
export class EmptyStateComponent {}
