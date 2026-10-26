import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { PublicTicket, ServiceArea } from '@vitalia/contracts';
import { catchError, firstValueFrom, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { TicketsApi } from '../../core/api/tickets.api';
import { PairingDialog, type PairingDialogData } from '../../shared/pairing-dialog';

/**
 * Check-in en recepción (RF-O5, `source: RECEPTION`): para quien llega sin celular o no usa
 * el portal cautivo. Es el mismo endpoint, idempotente por DNI (si ya tiene un turno abierto
 * hoy en ese servicio, devuelve ese).
 */
@Component({
  selector: 'vt-check-in-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './check-in-dialog.html',
  styleUrl: './check-in-dialog.scss',
})
export class CheckInDialog {
  private readonly api = inject(TicketsApi);
  protected readonly ref = inject(MatDialogRef<CheckInDialog, PublicTicket>);
  private readonly dialog = inject(MatDialog);

  protected readonly services = toSignal(this.api.services().pipe(catchError(() => of([] as ServiceArea[]))));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<PublicTicket | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    documentNumber: ['', [Validators.pattern(/^\d{7,9}$/)]],
    serviceCode: ['', [Validators.required]],
    reason: ['', [Validators.maxLength(280)]],
  });

  protected pair(t: PublicTicket): void {
    this.dialog.open<PairingDialog, PairingDialogData>(PairingDialog, {
      data: { ticketId: t.id, ticketCode: t.code },
      width: '440px',
      maxWidth: '94vw',
    });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    try {
      const ticket = await firstValueFrom(
        this.api.checkIn({
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          serviceCode: v.serviceCode,
          ...(v.documentNumber ? { documentNumber: v.documentNumber } : {}),
          ...(v.reason.trim() ? { reason: v.reason.trim() } : {}),
        }),
      );
      this.created.set(ticket);
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo registrar el turno'));
    } finally {
      this.saving.set(false);
    }
  }

  protected another(): void {
    this.created.set(null);
    this.form.reset({ serviceCode: this.form.controls.serviceCode.value });
  }
}
