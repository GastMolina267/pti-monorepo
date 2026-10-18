import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Ingresar · Vitalia',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'triaje' },
      {
        path: 'triaje',
        loadComponent: () => import('./features/triage/triage').then((m) => m.Triage),
        title: 'Triaje · Vitalia',
      },
      {
        path: 'turnos',
        loadComponent: () => import('./features/tickets/tickets').then((m) => m.Tickets),
        title: 'Turnos · Vitalia',
      },
      {
        path: 'alertas',
        loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts),
        title: 'Alertas · Vitalia',
      },
      {
        path: 'pulseras',
        loadComponent: () => import('./features/wearables/wearables').then((m) => m.Wearables),
        title: 'Pulseras · Vitalia',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
