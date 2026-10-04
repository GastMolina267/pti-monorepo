import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./features/display/display').then((m) => m.Display),
    title: 'Vitalia · Llamador',
  },
  { path: '**', redirectTo: '' },
];
