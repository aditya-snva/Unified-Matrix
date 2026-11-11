import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { ConnectorStatus, ConnectorStatuses, Conversation, LiveMessageEvent } from './models';

export type SocketState = 'disconnected' | 'connecting' | 'connected';

/** Thin wrapper over socket.io-client that exposes server events as RxJS streams. */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private hasConnectedOnce = false;

  readonly state = signal<SocketState>('disconnected');

  readonly message$ = new Subject<LiveMessageEvent>();
  readonly conversationUpdated$ = new Subject<{ conversation: Conversation }>();
  readonly connectorStatus$ = new Subject<ConnectorStatus>();
  readonly connectors$ = new Subject<ConnectorStatuses>();
  /** Fires after a dropped connection comes back, so the app can re-sync anything missed. */
  readonly reconnected$ = new Subject<void>();
  readonly unauthorized$ = new Subject<void>();

  connect(token: string): void {
    if (this.socket) return;
    this.state.set('connecting');

    const url = environment.apiUrl || window.location.origin;
    const socket = io(url, { auth: { token }, transports: ['websocket', 'polling'] });
    this.socket = socket;

    socket.on('connect', () => {
      this.state.set('connected');
      if (this.hasConnectedOnce) this.reconnected$.next();
      this.hasConnectedOnce = true;
    });
    socket.on('disconnect', (reason) => {
      // 'io client disconnect' = we called disconnect() ourselves.
      this.state.set(reason === 'io client disconnect' ? 'disconnected' : 'connecting');
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') this.unauthorized$.next();
      else this.state.set('connecting');
    });

    socket.on('message:new', (e: LiveMessageEvent) => this.message$.next(e));
    socket.on('conversation:updated', (e: { conversation: Conversation }) => this.conversationUpdated$.next(e));
    socket.on('connector:status', (s: ConnectorStatus) => this.connectorStatus$.next(s));
    socket.on('connectors', (s: ConnectorStatuses) => this.connectors$.next(s));
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.hasConnectedOnce = false;
    this.state.set('disconnected');
  }
}
