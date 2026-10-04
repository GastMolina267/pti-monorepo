import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { THEME_STORAGE_KEY } from '@vitalia/design-tokens';

export type ThemeMode = 'light' | 'dark';

/**
 * Modo claro/oscuro compartido por las apps Angular de Vitalia.
 * Aplica `data-theme` en <html> y `light-mode|dark-mode` en <body>, y persiste en
 * localStorage con la misma clave que el portal cautivo (`vitalia_theme`).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.readStored());

  constructor() {
    effect(() => {
      const mode = this.mode();
      const html = this.document.documentElement;
      html.setAttribute('data-theme', mode);
      this.document.body.classList.remove('light-mode', 'dark-mode');
      this.document.body.classList.add(`${mode}-mode`);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        /* storage no disponible: el modo vive solo en memoria */
      }
    });
  }

  toggle(): void {
    this.mode.update((m) => (m === 'light' ? 'dark' : 'light'));
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private readStored(): ThemeMode {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {
      /* ignore */
    }
    return 'light';
  }
}
