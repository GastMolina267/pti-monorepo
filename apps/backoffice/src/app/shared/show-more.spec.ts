import { signal } from '@angular/core';
import { incremental } from './show-more';

describe('incremental', () => {
  it('dibuja por tandas y vuelve a la primera cuando cambia el filtro, no la lista', () => {
    const list = signal(Array.from({ length: 120 }, (_, i) => i));
    const filter = signal('');
    const view = incremental(list, filter, 50);

    expect(view.items().length).toBe(50);
    expect(view.rest()).toBe(70);

    view.more();
    expect(view.items().length).toBe(100);
    expect(view.rest()).toBe(20);

    // Llega una lectura: la lista cambia, pero no se pierde lo que ya se mostró
    list.update((l) => [...l, 120]);
    expect(view.items().length).toBe(100);
    expect(view.rest()).toBe(21);

    filter.set('B-0');
    expect(view.items().length).toBe(50);

    view.more();
    view.more();
    expect(view.items().length).toBe(121);
    expect(view.rest()).toBe(0);
  });
});
