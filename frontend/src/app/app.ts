import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from './core/auth.service';
import { InboxStore } from './core/inbox.store';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly store = inject(InboxStore);

  constructor() {
    inject(ThemeService); // apply theme immediately

    // Live connection follows the login state.
    effect(() => {
      if (this.auth.isLoggedIn()) this.store.start();
      else this.store.stop();
    });

    // PWA: reload once a new version has been downloaded.
    const updates = inject(SwUpdate);
    if (updates.isEnabled) {
      updates.versionUpdates.subscribe((e) => {
        if (e.type === 'VERSION_READY' && confirm('A new version of Unified Matrix is available. Reload now?')) {
          document.location.reload();
        }
      });
    }
  }
}
