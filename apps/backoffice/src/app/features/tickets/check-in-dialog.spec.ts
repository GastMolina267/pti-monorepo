import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { CheckInDialog } from './check-in-dialog';

describe('CheckInDialog', () => {
  it('registra con source RECEPTION y muestra el número del turno', async () => {
    TestBed.configureTestingModule({
      imports: [CheckInDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(CheckInDialog);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/services')
      .flush([{ id: 's', code: 'CLINICA', name: 'Clínica Médica', prefix: 'A' }]);
    await fixture.whenStable();

    const cmp = fixture.componentInstance as unknown as {
      form: { setValue(v: object): void };
      save(): Promise<void>;
    };
    cmp.form.setValue({
      firstName: 'Ana',
      lastName: 'Pérez',
      documentNumber: '',
      serviceCode: 'CLINICA',
      reason: '',
    });
    const saving = cmp.save();
    const req = http.expectOne('/api/check-in');
    expect(req.request.body).toEqual({
      firstName: 'Ana',
      lastName: 'Pérez',
      serviceCode: 'CLINICA',
      source: 'RECEPTION',
    });
    req.flush({
      id: 't',
      code: 'A-015',
      status: 'WAITING',
      serviceName: 'Clínica Médica',
      position: 3,
      estimatedWaitMinutes: 36,
      checkedInAt: new Date().toISOString(),
    });
    await saving;
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.done .code')?.textContent).toBe('A-015');
    expect(el.textContent).toContain('3 paciente(s) adelante');
  });

  it('no envía si falta el servicio o el DNI tiene puntos', async () => {
    TestBed.configureTestingModule({
      imports: [CheckInDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(CheckInDialog);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/services').flush([]);
    const cmp = fixture.componentInstance as unknown as {
      form: { setValue(v: object): void };
      save(): Promise<void>;
    };
    cmp.form.setValue({
      firstName: 'Ana',
      lastName: 'Pérez',
      documentNumber: '30.123.456',
      serviceCode: '',
      reason: '',
    });
    await cmp.save();
    http.expectNone('/api/check-in');
  });
});
