import { Injectable, effect, signal } from '@angular/core';
import { readStorage, writeStorage } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);

  readonly mode = signal<ThemeMode>((readStorage('um_theme') as ThemeMode) || 'system');

  constructor() {
    this.media.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const mode = this.mode();
      const dark = mode === 'dark' || (mode === 'system' && this.systemDark());
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#ffffff');
      writeStorage('um_theme', mode);
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  cycle(): void {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    this.mode.set(order[(order.indexOf(this.mode()) + 1) % order.length]);
  }
}
