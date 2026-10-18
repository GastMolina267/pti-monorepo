import { isMqttPassword, parseWearableMqttPasswords } from './credentials';

describe('credenciales MQTT por pulsera', () => {
  it('valida códigos y conserva contraseñas sin modificarlas', () => {
    const input = { 'wb-02-5e0002': 'a'.repeat(32), 'wb-03-5e0003': 'b'.repeat(32) };
    expect(parseWearableMqttPasswords(input)).toEqual(input);
    expect(parseWearableMqttPasswords({})).toEqual({});
  });

  it.each([null, [], 'secreto', { api: 'x'.repeat(32) }, { 'wb-02-5e0002': 123 }])(
    'rechaza una estructura inválida',
    (input) => {
      expect(() => parseWearableMqttPasswords(input)).toThrow();
    },
  );

  it.each(['corta', 'x'.repeat(129), `${'x'.repeat(20)}\nuser:password`, `${'x'.repeat(20)}:extra`])(
    'rechaza contraseñas ambiguas sin incluirlas en el error',
    (password) => {
      expect(isMqttPassword(password)).toBe(false);
      expect(() => parseWearableMqttPasswords({ 'wb-02-5e0002': password })).toThrow();
      try {
        parseWearableMqttPasswords({ 'wb-02-5e0002': password });
      } catch (err) {
        expect((err as Error).message).not.toContain(password);
      }
    },
  );
});
