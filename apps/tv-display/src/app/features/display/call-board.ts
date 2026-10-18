import { RECENT_CALLS_LIMIT, type TicketCalledEvent } from '@vitalia/contracts';

/** Lo que muestra la TV: el llamado actual y los anteriores (el más reciente primero). */
export interface CallBoard {
  current: TicketCalledEvent | null;
  history: TicketCalledEvent[];
}

export const EMPTY_BOARD: CallBoard = { current: null, history: [] };
const HISTORY_SIZE = RECENT_CALLS_LIMIT - 1;

/**
 * Aplica un `ticket:called`. Un re-llamado del mismo turno lo vuelve a poner arriba sin
 * duplicarlo en el historial.
 */
export function applyCall(board: CallBoard, e: TicketCalledEvent): CallBoard {
  const previous = board.current && board.current.ticketId !== e.ticketId ? [board.current] : [];
  const history = [...previous, ...board.history]
    .filter((h) => h.ticketId !== e.ticketId)
    .slice(0, HISTORY_SIZE);
  return { current: e, history };
}

/** Arma el tablero desde `GET /api/tickets/recent-calls` (ya viene ordenado). */
export function fromRecent(list: TicketCalledEvent[]): CallBoard {
  const [current = null, ...rest] = list;
  return { current, history: rest.slice(0, HISTORY_SIZE) };
}
