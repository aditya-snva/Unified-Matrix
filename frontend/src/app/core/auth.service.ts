import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { readStorage, writeStorage } from './storage';

const TOKEN_KEY = 'um_token';

/** Returns true if the JWT is missing, malformed or past its `exp`. */
function isExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(readStorage(TOKEN_KEY));
  readonly isLoggedIn = computed(() => !isExpired(this.token()));

  async login(password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ token: string }>(`${environment.apiUrl}/api/auth/login`, { password }),
    );
    writeStorage(TOKEN_KEY, res.token);
    this.token.set(res.token);
  }

  logout(): void {
    writeStorage(TOKEN_KEY, null);
    this.token.set(null);
    this.router.navigate(['/login']);
  }
}
