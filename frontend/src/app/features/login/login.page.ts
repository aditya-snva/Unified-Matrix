import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { LogoComponent } from '../../shared/logo.component';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, LogoComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <form
        (ngSubmit)="submit()"
        class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-8 flex flex-col items-center gap-3 text-center">
          <app-logo size="size-12" />
          <div>
            <h1 class="text-xl font-semibold">Unified Matrix</h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">SMS, WhatsApp, Telegram and Gmail in one place</p>
          </div>
        </div>

        <label for="password" class="mb-1.5 block text-sm font-medium">Password</label>
        <div class="relative">
          <app-icon
            name="lock"
            size="size-4"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            autofocus
            [(ngModel)]="password"
            class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        @if (error()) {
          <p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{{ error() }}</p>
        }

        <button
          type="submit"
          [disabled]="loading() || !password"
          class="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.password || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.password);
      await this.router.navigate(['/inbox']);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      this.error.set(
        status === 401
          ? 'Wrong password.'
          : status === 429
            ? 'Too many attempts. Try again in a few minutes.'
            : 'Cannot reach the server. Is the backend running?',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
