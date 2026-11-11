import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ConnectorState } from '../core/models';

const COLORS: Record<ConnectorState | 'unknown', string> = {
  connected: 'bg-emerald-500',
  starting: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
  stopped: 'bg-slate-400',
  not_configured: 'bg-slate-300 dark:bg-slate-600',
  unknown: 'bg-slate-300 dark:bg-slate-600',
};

export const STATE_LABELS: Record<ConnectorState, string> = {
  connected: 'Connected',
  starting: 'Connecting…',
  error: 'Error',
  stopped: 'Stopped',
  not_configured: 'Not configured',
};

@Component({
  selector: 'app-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `<span class="size-2 rounded-full" [class]="color()"></span>`,
})
export class StatusDotComponent {
  readonly state = input<ConnectorState | undefined>();
  protected readonly color = computed(() => COLORS[this.state() ?? 'unknown']);
}
