import { composeSeq, SEQ_MAX_BOOT, splitSeq } from './seq';

describe('composeSeq', () => {
  it('ubica el arranque en los bits altos y el contador en los 24 bajos', () => {
    expect(composeSeq(0, 0)).toBe(0);
    expect(composeSeq(3, 7)).toBe(3 * 16_777_216 + 7);
  });

  it('crece aunque el contador se reinicie en el arranque siguiente', () => {
    expect(composeSeq(5, 0)).toBeGreaterThan(composeSeq(4, 16_777_215));
  });

  it('no desborda con arranques mayores a 127 (los << de JS son de 32 bits)', () => {
    expect(composeSeq(200, 1)).toBe(200 * 16_777_216 + 1);
    expect(Number.isSafeInteger(composeSeq(SEQ_MAX_BOOT, 16_777_215))).toBe(true);
  });

  it('rechaza partes fuera de rango', () => {
    expect(() => composeSeq(-1, 0)).toThrow(RangeError);
    expect(() => composeSeq(0, 16_777_216)).toThrow(RangeError);
    expect(() => composeSeq(SEQ_MAX_BOOT + 1, 0)).toThrow(RangeError);
    expect(() => composeSeq(1.5, 0)).toThrow(RangeError);
  });
});

describe('splitSeq', () => {
  it('es inversa de composeSeq', () => {
    expect(splitSeq(composeSeq(42, 1532))).toEqual({ boot: 42, counter: 1532 });
    expect(splitSeq(composeSeq(SEQ_MAX_BOOT, 16_777_215))).toEqual({
      boot: SEQ_MAX_BOOT,
      counter: 16_777_215,
    });
  });
});
