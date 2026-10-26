import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Logo, ThemeToggle } from '@vitalia/ui';
import { filter, map } from 'rxjs';
import { SITE } from './core/site';
import { AmbientLight } from './shared/ambient-light';

export type Audience = 'personas' | 'instituciones';

/** Audiencia según la URL: `/instituciones` es la B2B; todo lo demás, la B2C. */
export function audienceFromUrl(url: string): Audience {
  return url.split(/[?#]/)[0].startsWith('/instituciones') ? 'instituciones' : 'personas';
}

/**
 * Landing de Vitalia. Dos audiencias con un mismo shell:
 * - Personas (B2C): quién es Vitalia y cómo cambia la espera en el hospital.
 * - Instituciones (B2B): hospitales, financiadores e inversores; modelo de ingresos.
 */
@Component({
  selector: 'vt-root',
  imports: [RouterOutlet, RouterLink, Logo, ThemeToggle, AmbientLight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly site = SITE;
  protected readonly audience = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => audienceFromUrl(e.urlAfterRedirects)),
    ),
    { initialValue: audienceFromUrl(this.router.url) },
  );
}
