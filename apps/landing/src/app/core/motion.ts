import { DestroyRef, ElementRef, Injectable, afterNextRender, inject } from '@angular/core';
import { createScope, type Scope } from 'animejs';

/**
 * Punto único de entrada a anime.js para los componentes de la landing.
 *
 * - Respeta `prefers-reduced-motion`: sin animaciones, todo queda en su estado final.
 * - No corre en entornos sin `IntersectionObserver` (tests con jsdom, navegadores viejos).
 * - Encapsula cada componente en un `Scope` que se revierte al destruirlo, así no
 *   quedan observadores de scroll ni estilos inline colgados al cambiar de página.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  /** `true` si el navegador puede animar y la persona no pidió menos movimiento. */
  get enabled(): boolean {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Corre `setup` después del primer render, dentro de un scope de anime.js con raíz
   * en el host del componente. Si las animaciones están apagadas, no hace nada.
   * Llamalo desde el constructor (necesita el contexto de inyección).
   */
  scoped(setup: (scope: Scope, root: HTMLElement) => void): void {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    let scope: Scope | undefined;
    afterNextRender(() => {
      if (!this.enabled) return;
      scope = createScope({ root: host }).add((s) => setup(s as Scope, host.nativeElement));
    });
    destroyRef.onDestroy(() => scope?.revert());
  }
}
