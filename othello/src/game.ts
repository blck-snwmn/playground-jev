export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const BLACK = 1;
export const WHITE = -1;
export const EMPTY = 0;

export type Player = typeof BLACK | typeof WHITE;
export type Cell = Player | typeof EMPTY;
export type Board = Cell[];
export interface Position {
  board: Board;
  player: Player;
}

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function opponentOf(player: Player): Player {
  return player === BLACK ? WHITE : BLACK;
}

export function toCoordinate(index: number): string {
  const column = "abcdefgh"[index % BOARD_SIZE];
  const row = Math.floor(index / BOARD_SIZE) + 1;
  return `${column}${row}`;
}

export function createInitialBoard(): Board {
  const board: Board = Array(CELL_COUNT).fill(EMPTY);
  board[27] = board[36] = WHITE;
  board[28] = board[35] = BLACK;
  return board;
}

function isOnBoard(row: number, column: number): boolean {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

export function getFlippedDiscs(board: Board, player: Player, move: number): number[] {
  if (!Number.isInteger(move) || move < 0 || move >= CELL_COUNT || board[move] !== EMPTY) {
    return [];
  }

  const flippedDiscs: number[] = [];
  for (const [rowStep, columnStep] of DIRECTIONS) {
    let row = Math.floor(move / BOARD_SIZE) + rowStep;
    let column = (move % BOARD_SIZE) + columnStep;
    const line: number[] = [];

    while (isOnBoard(row, column) && board[row * BOARD_SIZE + column] === opponentOf(player)) {
      line.push(row * BOARD_SIZE + column);
      row += rowStep;
      column += columnStep;
    }

    // Flip a line only when it ends with one of the current player's discs.
    if (isOnBoard(row, column) && board[row * BOARD_SIZE + column] === player) {
      flippedDiscs.push(...line);
    }
  }
  return flippedDiscs;
}

export function getLegalMoves(board: Board, player: Player): number[] {
  return board.flatMap((_, index) =>
    getFlippedDiscs(board, player, index).length > 0 ? [index] : [],
  );
}

export function applyMove(board: Board, player: Player, move: number): Board {
  const flippedDiscs = getFlippedDiscs(board, player, move);
  if (flippedDiscs.length === 0) throw new Error("Illegal move");

  const nextBoard = [...board];
  nextBoard[move] = player;
  for (const index of flippedDiscs) nextBoard[index] = player;
  return nextBoard;
}

/** Returns the same player on a pass, or null when neither player can move. */
export function getNextPlayer(board: Board, currentPlayer: Player): Player | null {
  const opponent = opponentOf(currentPlayer);
  if (getLegalMoves(board, opponent).length > 0) return opponent;
  if (getLegalMoves(board, currentPlayer).length > 0) return currentPlayer;
  return null;
}

export function countDiscs(board: Board) {
  return {
    black: board.filter((cell) => cell === BLACK).length,
    white: board.filter((cell) => cell === WHITE).length,
  };
}

export function isPosition(value: unknown): value is Position {
  if (typeof value !== "object" || value === null) return false;
  const position = value as Partial<Position>;
  return (
    Array.isArray(position.board) &&
    position.board.length === CELL_COUNT &&
    position.board.every((cell) => cell === EMPTY || cell === BLACK || cell === WHITE) &&
    (position.player === BLACK || position.player === WHITE)
  );
}
