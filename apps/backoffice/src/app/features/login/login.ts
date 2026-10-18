import { ChangeDetectionStrategy, Component, inject, input, isDevMode, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { LucideLogIn, LucideShieldCheck, LucideTriangleAlert } from '@lucide/angular';
import { Logo, ThemeToggle } from '@vitalia/ui';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { AlarmService } from '../../core/sound/alarm.service';

@Component({
  selector: 'vt-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    Logo,
    ThemeToggle,
    LucideLogIn,
    LucideShieldCheck,
    LucideTriangleAlert,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alarm = inject(AlarmService);

  /** Query params (`withComponentInputBinding`). */
  readonly redirect = input<string>();
  readonly motivo = input<string>();

  protected readonly devMode = isDevMode();
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    // Click del usuario: el navegador deja habilitar el audio de las alertas.
    this.alarm.unlock();
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(this.safeRedirect()),
        error: (err: unknown) => this.error.set(apiErrorMessage(err, 'No se pudo iniciar sesión')),
      });
  }

  /** Solo rutas internas (evita redirecciones abiertas). */
  private safeRedirect(): string {
    const r = this.redirect();
    return r && r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/login') ? r : '/triaje';
  }
}
