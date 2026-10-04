import { TestBed } from '@angular/core/testing';
import { Logo } from './logo';

describe('Logo', () => {
  it('renderiza el logotipo Vitalia con subtítulo por defecto', async () => {
    const fixture = TestBed.createComponent(Logo);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.word')?.textContent?.replace(/\s/g, '')).toBe('Vitalia');
    expect(el.querySelector('.sub')?.textContent).toContain('Ecosistema Digital Hospitalario');
  });

  it('oculta el subtítulo cuando es null', async () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.componentRef.setInput('subtitle', null);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.sub')).toBeNull();
  });
});
