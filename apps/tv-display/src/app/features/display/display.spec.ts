import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { REALTIME_EVENTS, REALTIME_READY_EVENT, type TicketCalledEvent } from '@vitalia/contracts';
import { FakeSocket } from '../../../testing/fake-socket';
import { SOCKET_FACTORY } from '../../core/realtime/realtime.service';
import { AnnouncerService } from '../../core/sound/announcer.service';
import { Display } from './display';

const call = (code: string, room: string): TicketCalledEvent => ({
  ticketId: code,
  ticketCode: code,
  consultingRoom: room,
  calledAt: new Date().toISOString(),
});

describe('Display (llamador)', () => {
  beforeEach(() => localStorage.clear());

  async function setup() {
    const socket = new FakeSocket(null);
    const announce = vi.fn();
    TestBed.configureTestingModule({
      imports: [Display],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SOCKET_FACTORY, useValue: () => socket.asSocket() },
        { provide: AnnouncerService, useValue: { announce, unlock: vi.fn(), needsUnlock: () => false } },
      ],
    });
    const fixture = TestBed.createComponent(Display);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    return { fixture, http, socket, announce, el: fixture.nativeElement as HTMLElement };
  }

  it('arranca con los últimos llamados y anuncia los nuevos en vivo', async () => {
    const { fixture, http, socket, announce, el } = await setup();
    http
      .expectOne('/api/tickets/recent-calls')
      .flush([call('A-023', 'Consultorio 2'), call('B-011', 'Guardia')]);
    await fixture.whenStable();
    expect(el.querySelector('.call .code')?.textContent).toBe('A-023');
    expect(el.querySelector('.history')?.textContent).toContain('B-011');

    socket.fire(REALTIME_READY_EVENT, { room: 'tv' });
    http
      .expectOne('/api/tickets/recent-calls')
      .flush([call('A-023', 'Consultorio 2'), call('B-011', 'Guardia')]);
    socket.fire(REALTIME_EVENTS.TICKET_CALLED, call('A-024', 'Consultorio 4'));
    await fixture.whenStable();
    expect(el.querySelector('.call .code')?.textContent).toBe('A-024');
    expect(el.querySelector('.call .room')?.textContent).toBe('Consultorio 4');
    expect(el.querySelector('.history li strong')?.textContent).toBe('A-023');
    expect(announce).toHaveBeenCalledWith(expect.objectContaining({ ticketCode: 'A-024' }));
    expect(el.querySelector('.conn')?.textContent).toContain('En vivo');
  });

  it('si la API no responde muestra el último estado guardado', async () => {
    localStorage.setItem(
      'vitalia_tv_board',
      JSON.stringify({ current: call('C-007', 'Pediatría'), history: [] }),
    );
    const { fixture, http, el } = await setup();
    http.expectOne('/api/tickets/recent-calls').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(el.querySelector('.call .code')?.textContent).toBe('C-007');
    expect(el.querySelector('.conn')?.textContent).toContain('Reconectando');
  });
});
