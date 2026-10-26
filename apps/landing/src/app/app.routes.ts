import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/personas/personas').then((m) => m.Personas),
    title: 'Vitalia · La sala de espera, con pulso',
  },
  {
    path: 'instituciones',
    loadComponent: () => import('./features/instituciones/instituciones').then((m) => m.Instituciones),
    title: 'Vitalia para instituciones · Modelo, mercado y demo',
  },
  {
    path: 'privacidad',
    loadComponent: () => import('./features/legal/privacy').then((m) => m.Privacy),
    title: 'Privacidad · Vitalia',
  },
  {
    path: '**',
    loadComponent: () => import('./features/legal/not-found').then((m) => m.NotFound),
    title: 'Página no encontrada · Vitalia',
  },
];
