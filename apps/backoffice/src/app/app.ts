import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@vitalia/ui';

@Component({
  selector: 'vt-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class App {
  // Instancia el servicio para aplicar el modo guardado desde el arranque.
  protected readonly theme = inject(ThemeService);
}
