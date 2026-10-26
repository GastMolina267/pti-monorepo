import { gatewayHost } from './gateway-host';

describe('host del gateway según el bind', () => {
  it('usa localhost con el valor por defecto, todas las interfaces o loopback', () => {
    for (const bind of [undefined, '', '  ', '0.0.0.0', '127.0.0.1', 'localhost']) {
      expect(gatewayHost(bind)).toBe('localhost');
    }
  });

  it('usa la IP puntual del bind, sin espacios', () => {
    expect(gatewayHost('192.168.100.17')).toBe('192.168.100.17');
    expect(gatewayHost(' 10.0.20.1 ')).toBe('10.0.20.1');
  });
});
