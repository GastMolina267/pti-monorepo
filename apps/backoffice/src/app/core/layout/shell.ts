import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Logo, ThemeToggle } from '@vitalia/ui';

@Component({
  selector: 'vt-shell',
  imports: [RouterOutlet, Logo, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="brand">
        <vt-logo [size]="38" />
        <span class="badge">Backoffice</span>
      </div>
      <vt-theme-toggle />
    </header>
    <main class="content">
      <router-outlet />
    </main>
    <footer class="footer">© 2026 Vitalia · Ecosistema Digital Hospitalario · PTI UBP</footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px clamp(16px, 4vw, 40px);
      background: color-mix(in srgb, var(--vt-bg) 88%, transparent);
      border-bottom: 1px solid var(--vt-stroke);
      backdrop-filter: blur(14px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 999px;
      color: var(--vt-primary);
      border: 1px solid var(--vt-stroke-2);
      background: var(--vt-surface-2);
    }
    .content {
      flex: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px);
    }
    .footer {
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: var(--vt-muted-2);
    }
  `,
})
export class Shell {}
