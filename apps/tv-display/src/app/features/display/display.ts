import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { LucideWifi } from '@lucide/angular';
import { TicketCalledEvent } from '@vitalia/contracts';
import { Logo } from '@vitalia/ui';

/**
 * Pantalla del llamador. En Fase 3 se suscribe al evento `ticket:called`
 * (REALTIME_EVENTS.TICKET_CALLED) vía Socket.IO; por ahora muestra datos de ejemplo.
 */
@Component({
  selector: 'vt-display',
  imports: [Logo, LucideWifi],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './display.html',
  styleUrl: './display.scss',
})
export class Display {
  protected readonly now = signal(new Date());

  protected readonly current = signal<TicketCalledEvent>({
    ticketId: 'demo-24',
    ticketCode: 'A-024',
    consultingRoom: 'Consultorio 4',
    professionalName: 'Dra. Fernández',
    calledAt: new Date().toISOString(),
  });

  protected readonly history = signal([
    { code: 'A-023', room: 'Consultorio 2' },
    { code: 'B-011', room: 'Guardia' },
    { code: 'A-022', room: 'Consultorio 1' },
  ]);

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected time(d: Date): string {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  protected date(d: Date): string {
    const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
