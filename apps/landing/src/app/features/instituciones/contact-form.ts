import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SITE } from '../../core/site';

export const PROFILES = ['Hospital o clínica', 'Inversor', 'Obra social o financiador', 'Otro'] as const;
export type Profile = (typeof PROFILES)[number];

export interface ContactRequest {
  name: string;
  organization: string;
  profile: Profile;
  email: string;
  message: string;
}

/** Arma el `mailto:` con asunto y cuerpo listos para enviar. */
export function buildMailto(to: string, r: ContactRequest): string {
  const subject = `Vitalia · ${r.profile} · ${r.organization}`;
  const body = [
    `Nombre: ${r.name}`,
    `Organización: ${r.organization}`,
    `Perfil: ${r.profile}`,
    `Email: ${r.email}`,
    '',
    r.message,
  ].join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Pedido de demo o reunión. No envía nada por su cuenta (el sitio no tiene backend):
 * abre el programa de correo de la persona con el mensaje armado.
 */
@Component({
  selector: 'vt-contact-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
})
export class ContactForm {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly profiles = PROFILES;
  protected readonly to = SITE.contactEmail;
  protected readonly opened = signal(false);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    organization: ['', [Validators.required, Validators.maxLength(120)]],
    profile: this.fb.control<Profile>('Hospital o clínica'),
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1500)]],
  });

  protected error(field: 'name' | 'organization' | 'email' | 'message'): string | null {
    const c = this.form.controls[field];
    if (!(c.touched || this.submitted()) || c.valid) return null;
    if (c.hasError('required')) return 'Completá este campo.';
    if (c.hasError('email')) return 'Revisá el email: falta el @ o el dominio.';
    if (c.hasError('minlength')) return 'Contanos un poco más: al menos 20 caracteres.';
    return 'Es demasiado largo.';
  }

  protected send(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    window.location.href = buildMailto(this.to, this.form.getRawValue());
    this.opened.set(true);
  }
}
