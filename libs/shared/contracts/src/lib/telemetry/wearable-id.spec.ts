import { formatWearableCode, parseWearableCode, WEARABLE_CODE_PATTERN } from './wearable-id';

describe('formatWearableCode', () => {
  it('arma wb-<NN>-<mac> con el número en dos dígitos y la MAC en minúscula', () => {
    expect(formatWearableCode(7, '24D7CC')).toBe('wb-07-24d7cc');
    expect(formatWearableCode(42, 'a1b2c3')).toBe('wb-42-a1b2c3');
  });

  it('rechaza números fuera de 1–99 o no enteros', () => {
    expect(() => formatWearableCode(0, '24d7cc')).toThrow(RangeError);
    expect(() => formatWearableCode(100, '24d7cc')).toThrow(RangeError);
    expect(() => formatWearableCode(1.5, '24d7cc')).toThrow(RangeError);
  });

  it('rechaza sufijos de MAC que no son 6 hex', () => {
    expect(() => formatWearableCode(1, '24d7c')).toThrow(RangeError);
    expect(() => formatWearableCode(1, '24:d7:cc')).toThrow(RangeError);
    expect(() => formatWearableCode(1, 'zzzzzz')).toThrow(RangeError);
  });
});

describe('parseWearableCode', () => {
  it('separa número y MAC', () => {
    expect(parseWearableCode('wb-01-24d7cc')).toEqual({ number: 1, macSuffix: '24d7cc' });
  });

  it('es inversa de formatWearableCode', () => {
    const code = formatWearableCode(99, 'ABCDEF');
    expect(parseWearableCode(code)).toEqual({ number: 99, macSuffix: 'abcdef' });
    expect(WEARABLE_CODE_PATTERN.test(code)).toBe(true);
  });

  it('devuelve null para formatos viejos o inválidos', () => {
    for (const code of [
      'w-07',
      'wb-24d7cc',
      'wb-7-24d7cc',
      'wb-00-24d7cc',
      'wb-07-24D7CC',
      'wb-07-24d7cc0',
    ]) {
      expect(parseWearableCode(code)).toBeNull();
    }
  });
});
