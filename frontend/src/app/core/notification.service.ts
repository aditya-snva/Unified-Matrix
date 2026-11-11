import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { readStorage, writeStorage } from './storage';

const KEY = 'um_notify';
const supported = typeof window !== 'undefined' && 'Notification' in window;

/**
 * Desktop/phone notifications for new messages while the app is in the background.
 * Uses the service worker when available (required on Android Chrome), else the Notification API.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly router = inject(Router);
  private readonly swPush = inject(SwPush);

  readonly supported = supported;
  readonly permission = signal<NotificationPermission>(supported ? Notification.permission : 'denied');
  readonly enabled = signal(supported && Notification.permission === 'granted' && readStorage(KEY) === '1');

  constructor() {
    // Clicking a notification shown by the service worker.
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) this.router.navigateByUrl(url);
    });
  }

  async enable(): Promise<boolean> {
    if (!supported) return false;
    const permission = await Notification.requestPermission();
    this.permission.set(permission);
    const ok = permission === 'granted';
    this.enabled.set(ok);
    writeStorage(KEY, ok ? '1' : '0');
    return ok;
  }

  disable(): void {
    this.enabled.set(false);
    writeStorage(KEY, '0');
  }

  /** Shows a notification only when enabled and the app is not currently visible. */
  async show(title: string, body: string, tag: string, url: string): Promise<void> {
    if (!this.enabled() || !supported || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

    const options: NotificationOptions = {
      body,
      tag, // one notification per conversation, replaced on each new message
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-72x72.png',
      data: {
        url,
        // Tells the Angular service worker what to do when the notification is clicked.
        onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url } },
      },
    };

    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        this.router.navigateByUrl(url);
        n.close();
      };
    } catch {
      /* notifications are best-effort */
    }
  }
}
