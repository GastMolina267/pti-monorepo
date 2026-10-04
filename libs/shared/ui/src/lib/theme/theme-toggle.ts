import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from './theme.service';

@Component({
  selector: 'vt-theme-toggle',
  imports: [LucideMoon, LucideSun],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="toggle"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.mode() === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'"
    >
      @if (theme.mode() === 'light') {
        <svg lucideMoon [size]="18" [strokeWidth]="2.2"></svg>
      } @else {
        <svg lucideSun [size]="18" [strokeWidth]="2.2"></svg>
      }
    </button>
  `,
  styles: `
    .toggle {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 1px solid var(--vt-stroke-2);
      background: var(--vt-surface);
      color: var(--vt-ink);
      cursor: pointer;
      transition: border-color 0.2s ease;
    }
    .toggle:hover {
      border-color: var(--vt-primary);
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}
