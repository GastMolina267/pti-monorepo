import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Llamador de turnos para TV en modo kiosco (VLAN 40). Siempre en modo oscuro. */
@Component({
  selector: 'vt-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class App {}
