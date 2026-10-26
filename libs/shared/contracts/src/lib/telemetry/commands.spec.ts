import { WEARABLE_COMMAND_TYPES, type WearableCommand, type WearableCommandType } from './commands';

describe('WEARABLE_COMMAND_TYPES', () => {
  it('coincide con los tipos de la unión WearableCommand', () => {
    // Si se agrega un comando a la unión y no a la lista (o al revés), esto no compila.
    const byType: Record<WearableCommand['type'], true> = {
      SHOW_TICKET: true,
      ASSIGN_TICKET: true,
      CLEAR_TICKET: true,
      RELEASE_WEARABLE: true,
    };
    const listed: Record<WearableCommandType, true> = byType;
    expect([...WEARABLE_COMMAND_TYPES].sort()).toEqual(Object.keys(listed).sort());
  });

  it('son identificadores válidos en C (el firmware los genera como CMD_<TIPO>)', () => {
    for (const type of WEARABLE_COMMAND_TYPES) expect(type).toMatch(/^[A-Z][A-Z_]*$/);
  });
});
