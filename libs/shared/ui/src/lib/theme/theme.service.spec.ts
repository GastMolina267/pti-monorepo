import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => localStorage.clear());

  it('alterna el modo y lo aplica en <html>', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('light');
    service.toggle();
    TestBed.tick();
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('vitalia_theme')).toBe('dark');
  });
});
