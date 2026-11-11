import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InboxStore } from '../../core/inbox.store';
import { UiStateService } from '../../core/ui-state.service';
import { IconComponent } from '../../shared/icon.component';
import { SidebarComponent } from './sidebar.component';

/** Authenticated layout: sidebar (drawer on mobile) + page outlet + connection banner. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'ui.closeDrawer()' },
  template: `
    <div class="flex h-dvh flex-col overflow-hidden">
      @if (store.socketState() === 'connecting') {
        <div
          class="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
          role="status"
        >
          <app-icon name="wifiOff" size="size-3.5" />
          Reconnecting… new messages will appear once the connection is back.
        </div>
      }

      <div class="flex min-h-0 flex-1">
        <!-- Desktop sidebar -->
        <app-sidebar class="hidden border-r border-slate-200 lg:flex dark:border-slate-800" />

        <!-- Mobile drawer -->
        @if (ui.drawerOpen()) {
          <div class="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              class="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
              aria-label="Close menu"
              (click)="ui.closeDrawer()"
            ></button>
            <app-sidebar class="relative z-10 shadow-xl" />
          </div>
        }

        <div class="min-w-0 flex-1">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
})
export class ShellComponent {
  protected readonly store = inject(InboxStore);
  protected readonly ui = inject(UiStateService);
}
