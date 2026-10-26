import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePhone, LucideShieldCheck, LucideStethoscope, LucideWifiOff } from '@lucide/angular';
import { animate, createTimeline, stagger, svg } from 'animejs';
import { Motion } from '../../core/motion';
import { Spotlight } from '../../shared/spotlight';
import { Faq } from '../../shared/faq';
import { TaglineReveal } from '../../shared/tagline-reveal';
import { CallTicker } from './call-ticker';
import { Journey } from './journey';
import { LiveVitals } from './live-vitals';
import { WaitingTimeline } from './waiting-timeline';
import { FAQ_PERSONAS, JOURNEY, PROBLEMS, PROMISES, TAGLINE } from './personas.content';

/** B2C: para quien quiere conocer Vitalia (pacientes, familias, comunidad). */
@Component({
  selector: 'vt-personas',
  imports: [
    Spotlight,
    RouterLink,
    Journey,
    LiveVitals,
    CallTicker,
    WaitingTimeline,
    TaglineReveal,
    Faq,
    LucideShieldCheck,
    LucideWifiOff,
    LucidePhone,
    LucideStethoscope,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personas.html',
  styleUrl: './personas.scss',
})
export class Personas {
  protected readonly problems = PROBLEMS;
  protected readonly journey = JOURNEY;
  protected readonly tagline = TAGLINE;
  protected readonly promises = PROMISES;
  protected readonly faq = FAQ_PERSONAS;

  constructor() {
    // Un único momento al cargar: la línea de pulso se dibuja y enciende el punto.
    inject(Motion).scoped((_scope, root) => {
      const [line] = svg.createDrawable(root.querySelectorAll('.pulse__line'));
      if (!line) return;
      createTimeline({ defaults: { ease: 'inOut(3)' } })
        .add(line, { draw: ['0 0', '0 1'], duration: 1900 }, 200)
        .add('.pulse__dot', { scale: [0, 1], opacity: [0, 1], duration: 600, ease: 'outBack(2)' }, '-=250')
        .add(
          '.hero__copy > *',
          { opacity: [0, 1], translateY: [24, 0], duration: 900, delay: stagger(90) },
          0,
        );
      animate('.pulse__ring', {
        scale: [1, 2.6],
        opacity: [0.5, 0],
        duration: 1800,
        loop: true,
        delay: 2300,
      });
    });
  }
}
