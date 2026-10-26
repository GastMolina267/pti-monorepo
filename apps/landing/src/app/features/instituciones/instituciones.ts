import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideLayers, LucideServer, LucideTrendingUp, LucideWrench } from '@lucide/angular';
import { animate, createTimeline, onScroll, stagger } from 'animejs';
import { Motion } from '../../core/motion';
import { Spotlight } from '../../shared/spotlight';
import { SOURCES } from '../../core/site';
import { Faq } from '../../shared/faq';
import { TaglineReveal } from '../../shared/tagline-reveal';
import { Architecture } from './architecture';
import { ContactForm } from './contact-form';
import { FactVizView } from './fact-viz';
import {
  FAQ_INSTITUCIONES,
  MARKET_FACTS,
  MEASUREMENTS,
  REVENUE_STREAMS,
  ROADMAP,
  SUSTAINABILITY,
} from './instituciones.content';
import { RevenueCalculator } from './revenue-calculator';

/** B2B: hospitales, financiadores e inversores. Mercado, modelo de ingresos y demo. */
@Component({
  selector: 'vt-instituciones',
  imports: [
    Spotlight,
    RouterLink,
    LucideCheck,
    LucideServer,
    LucideLayers,
    LucideTrendingUp,
    LucideWrench,
    RevenueCalculator,
    Architecture,
    FactVizView,
    TaglineReveal,
    Faq,
    ContactForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instituciones.html',
  styleUrl: './instituciones.scss',
})
export class Instituciones {
  protected readonly facts = MARKET_FACTS;
  protected readonly streams = REVENUE_STREAMS;
  protected readonly baseStreams = REVENUE_STREAMS.filter((s) => s.status === 'base');
  protected readonly sustainability = SUSTAINABILITY;
  protected readonly measurements = MEASUREMENTS;
  protected readonly roadmap = ROADMAP;
  protected readonly faq = FAQ_INSTITUCIONES;
  protected readonly sources = SOURCES;
  protected readonly tagline = [
    'Cada sede nueva',
    'suma ingresos recurrentes,',
    'no software nuevo.',
  ] as const;

  private readonly pctFmt = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
  protected pctLabel(v: number): string {
    return this.pctFmt.format(v);
  }

  constructor() {
    // Un momento al cargar: el titular entra y el "libro" de ingresos se completa línea a línea.
    inject(Motion).scoped(() => {
      createTimeline({ defaults: { ease: 'out(4)', duration: 900 } })
        .add('.hero__copy > *', { opacity: [0, 1], translateY: [24, 0], delay: stagger(90) }, 0)
        .add('.ledger__row', { opacity: [0, 1], translateX: [32, 0], delay: stagger(140) }, 350);
      // Las barras de "uso del objetivo" crecen cuando la tabla entra en pantalla.
      animate('.budget i', {
        scaleX: [0, 1],
        duration: 1200,
        delay: stagger(120),
        ease: 'out(4)',
        autoplay: onScroll({
          target: '.measure',
          enter: { container: 'bottom', target: 'top' },
          repeat: false,
        }),
      });
    });
  }
}
