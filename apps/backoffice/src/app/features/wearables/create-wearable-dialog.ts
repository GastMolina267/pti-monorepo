import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WEARABLE_CODE_PATTERN, type Wearable } from '@vitalia/contracts';
import { apiErrorMessage } from '../../core/api/api-error';
import { WearablesStore } from '../../core/live/wearables.store';

/** Mismo patrón que la API, aceptando mayúsculas y espacios (se normaliza al guardar). */
const wearableCode: ValidatorFn = (c) => {
  const v = String(c.value ?? '')
    .trim()
    .toLowerCase();
  return !v || WEARABLE_CODE_PATTERN.test(v) ? null : { pattern: true };
};

/** Alta de pulsera: `wb-<NN>-<mac>` (ADR 0011). La API rechaza números repetidos. */
@Component({
  selector: 'vt-create-wearable-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Dar de alta una pulsera</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="help">
          El código es el que muestra la pulsera al arrancar: <code>wb-</code> + número de 01 a 99 + los
          últimos 6 dígitos hex de su MAC.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Código</mat-label>
          <input
            matInput
            formControlName="code"
            placeholder="wb-09-a1b2c3"
            autocomplete="off"
            cdkFocusInitial
          />
          @if (form.controls.code.hasError('required')) {
            <mat-error>Ingresá el código</mat-error>
          } @else if (form.controls.code.hasError('pattern')) {
            <mat-error>Formato wb-NN-xxxxxx (ej. wb-07-24d7cc)</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Etiqueta (opcional)</mat-label>
          <input matInput formControlName="label" placeholder="Pulsera 9" maxlength="80" />
        </mat-form-field>
        @if (error(); as msg) {
          <p class="error" role="alert">{{ msg }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : 'Dar de alta' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
    .help {
      margin: 0 0 16px;
      color: var(--vt-muted);
      font-size: 13.5px;
      line-height: 1.5;
    }
    code {
      padding: 1px 5px;
      border-radius: 6px;
      background: var(--vt-surface-2);
      color: var(--vt-primary);
    }
    .error {
      margin: 0;
      color: var(--vt-danger);
      font-weight: 600;
    }
  `,
})
export class CreateWearableDialog {
  private readonly ref = inject(MatDialogRef<CreateWearableDialog, Wearable>);
  private readonly store = inject(WearablesStore);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, wearableCode]],
    label: [''],
  });

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const { code, label } = this.form.getRawValue();
    try {
      const w = await this.store.create({
        code: code.trim().toLowerCase(),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      this.ref.close(w);
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo dar de alta la pulsera'));
      this.saving.set(false);
    }
  }
}
