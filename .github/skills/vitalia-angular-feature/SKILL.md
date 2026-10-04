---
name: vitalia-angular-feature
description: Crear pantallas, features, componentes, servicios de datos o rutas en las apps Angular (apps/backoffice consola de triaje, apps/tv-display llamador) o en la lib @vitalia/ui. Usala para cualquier trabajo de frontend Angular - nuevas vistas, formularios, listas, dashboards, consumo de la API o tiempo real.
---

# Feature Angular (Angular 22, zoneless, signals)

## 1. Ubicación

| Qué | Dónde |
| --- | --- |
| Pantalla o flujo de una app | `apps/<app>/src/app/features/<feature>/` |
| Acceso a la API de un recurso | `apps/<app>/src/app/core/api/<recurso>.api.ts` |
| Layout, guards, interceptors, socket | `apps/<app>/src/app/core/` |
| Componente reutilizable entre apps (presentacional) | `libs/shared/ui` |
| Tipos y reglas | `@vitalia/contracts` (nunca redefinirlos en el front) |

## 2. Generá con Nx

```bash
pnpm nx g @nx/angular:component apps/backoffice/src/app/features/triage/triage-queue --no-interactive
```

El defecto del workspace ya es SCSS + OnPush. Revisá que **no** quede el sufijo `.component` en el nombre de archivo.

## 3. Plantillas

```ts
// core/api/tickets.api.ts
@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly http = inject(HttpClient);
  readonly queue = httpResource<TicketDto[]>(() => '/api/tickets?status=WAITING');
  call(id: string) {
    return this.http.post<TicketDto>(`/api/tickets/${id}/call`, {});
  }
}
```

```ts
// features/triage/triage-queue.ts
@Component({
  selector: 'vt-triage-queue',
  imports: [/* Material, lucide, @vitalia/ui */],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './triage-queue.html',
  styleUrl: './triage-queue.scss',
})
export class TriageQueue {
  private readonly api = inject(TicketsApi);
  protected readonly queue = this.api.queue;
  protected readonly critical = computed(() =>
    (this.queue.value() ?? []).filter((t) => assessVitals(t.lastReading ?? {}).level === 'CRITICAL'),
  );
}
```

```html
@if (queue.isLoading()) { <mat-progress-bar mode="indeterminate" /> }
@for (t of queue.value(); track t.id) {
  <vt-ticket-row [ticket]="t" />
} @empty {
  <p class="muted">No hay pacientes en espera.</p>
}
```

Ruta lazy en `app.routes.ts`:

```ts
{ path: 'triaje', loadComponent: () => import('./features/triage/triage-queue').then((m) => m.TriageQueue), title: 'Triaje · Vitalia' }
```

## 4. Reglas

- `OnPush`, standalone, `inject()`, `input()`/`output()`/`model()`, signals y `computed`. Sin `NgModule` ni `*ngIf`/`*ngFor`.
- Suscripciones manuales con `takeUntilDestroyed()`. Preferí `httpResource` y `toSignal`.
- Estilos: tokens `--vt-*` y utilidades `.vt-*`, Angular Material para controles. **Sin hex sueltos** (skill `vitalia-design-system`).
- Íconos: `import { LucideBell } from '@lucide/angular'` → `<svg lucideBell [size]="18"></svg>`.
- Textos en español rioplatense. Fechas con `es-AR`.
- Formularios: Reactive Forms tipados (o Signal Forms si ya están estables en el workspace), con mensajes de error en español.
- Responsivo de 360 px a escritorio. `aria-label` en botones de ícono.

## 5. Tests (vitest + TestBed)

```ts
TestBed.configureTestingModule({ imports: [TriageQueue], providers: [provideHttpClient(), provideHttpClientTesting()] });
```

Probá el render de estados (cargando, vacío, con datos, error) y la lógica de los `computed`.

## 6. Cierre

- [ ] Revisado en modo claro y oscuro, y en móvil
- [ ] `pnpm nx affected -t lint test build` en verde
- [ ] Tarea marcada en `docs/07-roadmap.md`
