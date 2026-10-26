import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { createTimeline, onScroll, svg } from 'animejs';
import { Motion } from '../../core/motion';
import { Spotlight } from '../../shared/spotlight';
import {
  type Camera,
  SCENES,
  SLOT,
  WORLD,
  flightCamera,
  flightWindow,
  focusCamera,
  signalPath,
  stepForProgress,
  viewBox,
} from './journey-camera';

export interface JourneyStep {
  readonly title: string;
  readonly body: string;
}

/** Partículas del ambiente (cruces y puntos) entre escenas: posiciones fijas en el mundo. */
const PARTICLES = [
  [700, 260, 'plus'],
  [760, 760, 'dot'],
  [900, 180, 'dot'],
  [1380, 300, 'plus'],
  [1400, 800, 'dot'],
  [1520, 220, 'dot'],
  [2050, 260, 'plus'],
  [2060, 780, 'dot'],
  [2180, 160, 'dot'],
  [2720, 250, 'dot'],
  [2730, 760, 'plus'],
  [2860, 170, 'dot'],
  [120, 180, 'dot'],
  [3300, 780, 'plus'],
  [240, 840, 'plus'],
  [3330, 220, 'dot'],
] as const;

/**
 * El recorrido del paciente como un vuelo continuo por la sala de espera
 * (idea de scroll-world, hecha con SVG + anime.js en lugar de video generado):
 * la cámara entra a cada escena y, al seguir scrolleando, sale, vuela siguiendo
 * la señal de la pulsera y entra a la siguiente. Sin animaciones, se ve el mapa
 * completo y todos los pasos.
 */
@Component({
  selector: 'vt-journey',
  imports: [Spotlight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.html',
  styleUrl: './journey.scss',
})
export class Journey {
  readonly steps = input.required<readonly JourneyStep[]>();

  protected readonly world = WORLD;
  protected readonly scenes = SCENES;
  protected readonly overview = `0 0 ${WORLD.w} ${WORLD.h}`;
  protected readonly particles = PARTICLES.map(([x, y, kind], i) => ({
    x,
    y,
    kind,
    delay: `${(i % 6) * -1.1}s`,
  }));
  /** Rótulo de cada escena dentro del mundo (qué pieza del sistema es). */
  protected readonly labels = [
    'Portal cautivo en el celular',
    'Pulsera IoMT · ESP32-C3',
    'Router con VLAN + gateway local',
    'Consola de triaje del personal',
    'Llamador en la TV de la sala',
  ].map((text) => ({ text, w: Math.round(text.length * 11.2 + 64) }));
  protected readonly segments = SCENES.slice(1).map((_, i) => signalPath(i, i + 1));
  /** Filas de la consola de ejemplo (pacientes simulados). */
  protected readonly rows = [
    { code: 'A-031', label: 'Crítico · caída', tone: 'critical' },
    { code: 'A-027', label: 'Atención · 104 lpm', tone: 'attention' },
    { code: 'A-024', label: 'Estable · 78 lpm', tone: 'stable' },
    { code: 'A-029', label: 'Estable · 71 lpm', tone: 'stable' },
  ] as const;
  /** Paso resaltado; `-1` cuando no hay animación (todos se ven igual). */
  protected readonly active = signal(-1);

  constructor() {
    const motion = inject(Motion);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    // Movimiento reducido: la cámara corta de escena en escena según el paso visible, sin vuelo.
    afterNextRender(() => {
      if (motion.enabled || typeof IntersectionObserver === 'undefined') return;
      const stage = host.querySelector<SVGSVGElement>('.stage__svg');
      const steps = Array.from(host.querySelectorAll<HTMLElement>('.step'));
      if (!stage || !steps.length) return;
      const show = (i: number) => {
        this.active.set(i);
        stage.setAttribute('viewBox', viewBox(focusCamera(i)));
      };
      show(0);
      const io = new IntersectionObserver(
        (entries) =>
          entries
            .filter((e) => e.isIntersecting)
            .forEach((e) => show(steps.indexOf(e.target as HTMLElement))),
        { rootMargin: '-45% 0px -45% 0px' },
      );
      steps.forEach((s) => io.observe(s));
      destroyRef.onDestroy(() => io.disconnect());
    });

    motion.scoped((_scope, root) => {
      const stage = root.querySelector<SVGSVGElement>('.stage__svg');
      const steps = root.querySelector<HTMLElement>('.steps');
      if (!stage || !steps) return;

      const cam: Camera = { ...focusCamera(0) };
      const apply = () => stage.setAttribute('viewBox', viewBox(cam));
      apply();
      this.active.set(0);

      const signals = Array.from(root.querySelectorAll<SVGPathElement>('.w-signal'));
      const packets = Array.from(root.querySelectorAll<SVGCircleElement>('.w-packet'));
      const drawables = svg.createDrawable(signals);

      // El timeline sigue a la lista de pasos: empieza cuando el primer paso llega al
      // centro de la pantalla y termina cuando el último lo deja. Así la escena y su
      // texto coinciden en el centro, en cualquier alto de pantalla.
      const tl = createTimeline({
        defaults: { ease: 'inOut(3)' },
        onUpdate: (self) => {
          apply();
          this.active.set(stepForProgress(self.progress));
        },
        autoplay: onScroll({
          target: steps,
          enter: { container: 'center', target: 'top' },
          leave: { container: 'center', target: 'bottom' },
          sync: 0.35,
        }),
      });

      tl.set(drawables, { draw: '0 0' }, 0);
      tl.set(packets, { opacity: 0 }, 0);

      for (let i = 0; i < SCENES.length - 1; i++) {
        const { start, duration } = flightWindow(i);
        tl.add(cam, { ...flightCamera(i, i + 1), duration: duration / 2, ease: 'in(2)' }, start)
          .add(cam, { ...focusCamera(i + 1), duration: duration / 2, ease: 'out(3)' }, start + duration / 2)
          .add(drawables[i], { draw: ['0 0', '0 1'], duration, ease: 'inOut(2)' }, start)
          .add(
            packets[i],
            {
              ...svg.createMotionPath(signals[i]),
              opacity: [
                { to: 1, duration: duration * 0.1 },
                { to: 1, duration: duration * 0.8 },
                { to: 0, duration: duration * 0.1 },
              ],
              duration,
              ease: 'inOut(2)',
            },
            start,
          );
      }
      // El timeline dura un tramo por paso: la TV queda quieta durante todo el último.
      const last = flightWindow(SCENES.length - 2);
      const tail = SCENES.length * SLOT - (last.start + last.duration);
      tl.add(cam, { w: cam.w, duration: tail }, last.start + last.duration);
    });
  }
}
