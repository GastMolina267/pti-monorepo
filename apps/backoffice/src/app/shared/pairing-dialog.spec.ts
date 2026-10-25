import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatPairingCode, PairingDialog, qrPath, remaining } from './pairing-dialog';

describe('PairingDialog', () => {
  it('formatea el código y la cuenta regresiva', () => {
    expect(formatPairingCode('K7M2QX')).toBe('K7M 2QX');
    const now = Date.parse('2026-10-25T15:00:00Z');
    expect(remaining('2026-10-25T15:09:05Z', now)).toBe('9:05');
    expect(remaining('2026-10-25T14:59:00Z', now)).toBe('0:00');
  });

  it('dibuja el QR del código con módulos de 1×1', () => {
    const { size, d } = qrPath('vitalia://vincular?codigo=K7M2QX');
    expect(size).toBeGreaterThanOrEqual(21);
    expect(d).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it('pide el código del turno al abrir y lo muestra', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { ticketId: 't-1', ticketCode: 'A-024' } },
      ],
    });
    const fixture = TestBed.createComponent(PairingDialog);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne({ method: 'POST', url: '/api/tickets/t-1/pairing' }).flush({
      code: 'K7M2QX',
      ticketCode: 'A-024',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('K7M 2QX');
    expect(text).toContain('A-024');
    expect(text).toMatch(/Vence en (9|10):\d\d/);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('svg.qr path')?.getAttribute('d'),
    ).toBeTruthy();
    http.verify();
  });
});
