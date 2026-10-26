import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Reflejo de luz que sigue al cursor dentro de una tarjeta (borde y brillo suave).
 * Solo con mouse y sin movimiento reducido; los estilos están en `styles.scss` (`.vt-spot`).
 */
@Directive({
  selector: '[vtSpotlight]',
  host: { class: 'vt-spot' },
})
export class Spotlight {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.addEventListener(
        'pointermove',
        (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--sx', `${e.clientX - r.left}px`);
          el.style.setProperty('--sy', `${e.clientY - r.top}px`);
          el.style.setProperty('--so', '1');
        },
        { passive: true },
      );
      el.addEventListener('pointerleave', () => el.style.setProperty('--so', '0'));
    });
  }
}
