import { Injectable, signal } from '@angular/core';

/** Small bits of layout state shared between the shell and pages. */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  /** Mobile navigation drawer. */
  readonly drawerOpen = signal(false);

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
