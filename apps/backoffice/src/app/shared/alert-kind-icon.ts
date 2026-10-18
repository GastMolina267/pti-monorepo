import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDroplets, LucideHeartPulse, LucidePersonStanding, LucideThermometer } from '@lucide/angular';
import type { AlertKind } from '@vitalia/contracts';

/** Ícono por tipo de alerta (acompaña siempre al texto). */
@Component({
  selector: 'vt-alert-kind-icon',
  imports: [LucidePersonStanding, LucideDroplets, LucideHeartPulse, LucideThermometer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (kind()) {
      @case ('FALL') {
        <svg lucidePersonStanding [size]="size()"></svg>
      }
      @case ('HYPOXIA') {
        <svg lucideDroplets [size]="size()"></svg>
      }
      @case ('FEVER') {
        <svg lucideThermometer [size]="size()"></svg>
      }
      @case ('HYPOTHERMIA') {
        <svg lucideThermometer [size]="size()"></svg>
      }
      @default {
        <svg lucideHeartPulse [size]="size()"></svg>
      }
    }
  `,
  styles: ':host { display: inline-grid; place-items: center; }',
})
export class AlertKindIcon {
  readonly kind = input.required<AlertKind>();
  readonly size = input(20);
}
