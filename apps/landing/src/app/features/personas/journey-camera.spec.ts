import {
  CAMERA_RATIO,
  FLIGHT_W,
  FOCUS_W,
  SLOT,
  flightWindow,
  SCENES,
  WORLD,
  flightCamera,
  focusCamera,
  signalPath,
  stepForProgress,
  viewBox,
} from './journey-camera';

describe('cámara del recorrido', () => {
  it('centra cada escena con el zoom de "adentro"', () => {
    SCENES.forEach((s, i) => {
      const c = focusCamera(i);
      expect(c.w).toBe(FOCUS_W);
      expect(c.h).toBeCloseTo(FOCUS_W * CAMERA_RATIO);
      expect(c.x + c.w / 2).toBeCloseTo(s.cx);
      expect(c.y + c.h / 2).toBeCloseTo(s.cy);
    });
  });

  it('se aleja entre escenas', () => {
    const c = flightCamera(0, 1);
    expect(c.w).toBe(FLIGHT_W);
    expect(c.x + c.w / 2).toBeCloseTo((SCENES[0].cx + SCENES[1].cx) / 2);
  });

  it('las escenas están dentro del mundo y en orden', () => {
    SCENES.forEach((s, i) => {
      expect(s.cx).toBeGreaterThan(0);
      expect(s.cx).toBeLessThan(WORLD.w);
      if (i > 0) expect(s.cx).toBeGreaterThan(SCENES[i - 1].cx);
    });
  });

  it('formatea el viewBox', () => {
    expect(viewBox({ x: 1.234, y: 2, w: 3.05, h: 4 })).toBe('1.2 2 3.1 4');
  });

  it('reparte el progreso en pasos iguales', () => {
    expect(stepForProgress(0)).toBe(0);
    expect(stepForProgress(0.19)).toBe(0);
    expect(stepForProgress(0.21)).toBe(1);
    expect(stepForProgress(0.99)).toBe(SCENES.length - 1);
    expect(stepForProgress(1)).toBe(SCENES.length - 1);
    expect(stepForProgress(-3)).toBe(0);
    expect(stepForProgress(7)).toBe(SCENES.length - 1);
  });

  it('la señal sale de una escena y llega a la siguiente', () => {
    const d = signalPath(1, 2);
    expect(d.startsWith(`M ${SCENES[1].cx + 200} ${SCENES[1].cy}`)).toBe(true);
    expect(d.endsWith(`${SCENES[2].cx - 200} ${SCENES[2].cy}`)).toBe(true);
  });

  it('vuela entre pasos, centrado en el borde de cada tramo', () => {
    const w = flightWindow(0);
    expect(w.start + w.duration / 2).toBe(SLOT);
    expect(w.start).toBeGreaterThan(0);
    // La última escena queda quieta en todo su tramo.
    const last = flightWindow(SCENES.length - 2);
    expect(last.start + last.duration).toBeLessThan(SCENES.length * SLOT);
    // La cámara está quieta en el centro de cada tramo, donde el texto cruza la pantalla.
    for (let i = 0; i < SCENES.length; i++) {
      const center = (i + 0.5) * SLOT;
      if (i > 0) expect(flightWindow(i - 1).start + flightWindow(i - 1).duration).toBeLessThan(center);
      if (i < SCENES.length - 1) expect(flightWindow(i).start).toBeGreaterThan(center);
    }
  });
});
