import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectorStatuses, Conversation, Message, Platform, UnreadCounts } from './models';

type Params = Record<string, string | number | boolean | undefined | null>;

function toParams(params: Params): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;

  private get<T>(path: string, params: Params = {}): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + path, { params: toParams(params) }));
  }

  conversations(opts: { platform?: Platform; unread?: boolean; before?: string; limit?: number }) {
    return this.get<{ items: Conversation[] }>('/conversations', {
      platform: opts.platform,
      unread: opts.unread ? 'true' : undefined,
      before: opts.before,
      limit: opts.limit,
    });
  }

  unreadCounts() {
    return this.get<UnreadCounts>('/conversations/unread-counts');
  }

  conversation(key: string) {
    return this.get<Conversation>(`/conversations/${encodeURIComponent(key)}`);
  }

  messages(key: string, opts: { before?: string; limit?: number } = {}) {
    return this.get<{ items: Message[] }>(`/conversations/${encodeURIComponent(key)}/messages`, opts);
  }

  markRead(key: string) {
    return firstValueFrom(
      this.http.post<Conversation>(`${this.base}/conversations/${encodeURIComponent(key)}/read`, {}),
    );
  }

  search(opts: { q?: string; platform?: Platform; before?: string; limit?: number }) {
    return this.get<{ items: Message[] }>('/messages', opts);
  }

  message(id: string) {
    return this.get<Message>(`/messages/${id}`);
  }

  status() {
    return this.get<ConnectorStatuses>('/status');
  }
}
