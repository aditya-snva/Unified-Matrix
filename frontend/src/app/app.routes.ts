import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inbox' },
      {
        path: 'inbox',
        loadComponent: () => import('./features/inbox/inbox.page').then((m) => m.InboxPage),
        children: [
          {
            path: '',
            loadComponent: () => import('./features/inbox/empty-state.component').then((m) => m.EmptyStateComponent),
          },
          {
            path: ':key',
            loadComponent: () =>
              import('./features/inbox/conversation-view.component').then((m) => m.ConversationViewComponent),
          },
        ],
      },
      {
        path: 'search',
        loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
