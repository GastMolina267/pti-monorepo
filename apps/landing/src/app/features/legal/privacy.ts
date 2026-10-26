import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Política de privacidad del sitio (no del producto: el gateway tiene la suya). */
@Component({
  selector: 'vt-privacy',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="lp-container lp-section legal">
      <h1>Privacidad</h1>
      <p class="lp-lead">Este sitio no usa cookies, no tiene analítica ni guarda lo que escribís.</p>
      <h2>El sitio</h2>
      <p>
        Solo recuerda si elegiste el modo claro u oscuro, en el almacenamiento de tu navegador. El formulario
        de contacto no envía nada por su cuenta: arma un correo en tu programa de mail y vos decidís si
        mandarlo.
      </p>
      <h2>El producto</h2>
      <p>
        En Vitalia, los signos vitales y los datos de pacientes son datos sensibles (Ley 25.326). Se cifran
        con AES-256-GCM desde la pulsera, se guardan en el servidor del hospital y a la nube se replican solo
        los cambios de turnos y alertas, sin DNI. En desarrollo y en las demos se usan exclusivamente datos
        simulados.
      </p>
      <p><a routerLink="/">Volver al inicio</a></p>
    </article>
  `,
  styles: `
    .legal {
      display: grid;
      gap: var(--lp-s-5);
      max-width: 760px;
    }
    h1 {
      font-size: var(--lp-text-5xl);
      line-height: 1;
      letter-spacing: -0.03em;
    }
    h2 {
      margin-top: var(--lp-s-4);
      font-size: var(--lp-text-2xl);
      line-height: 32px;
    }
    p {
      max-width: 68ch;
    }
  `,
})
export class Privacy {}
