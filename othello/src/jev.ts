import {
  BLACK,
  BOARD_SIZE,
  WHITE,
  applyMove,
  getFlippedDiscs,
  getLegalMoves,
  opponentOf,
  toCoordinate,
  type Board,
  type Position,
} from "./game";
/** Move and decision details returned by the local API. Imported as a type by the UI. */
export interface JevMoveResult {
  move: number;
  elapsed: number;
  confidence?: number;
  probabilities?: Record<string, number>;
  model?: string;
}

const JEV_API_URL = "https://api.typesafe.ai/v1/systemone";
const REQUEST_TIMEOUT_MS = 30_000;
const GAME_RULES =
  "Othello, standard 8x8 rules. Most discs at the end wins. A player with no legal move passes; game ends when neither can move.";
const MOVE_INSTRUCTIONS =
  "Choose the legal move most likely to win this Othello game. Consider corners, mobility, stability, and avoiding giving away corners. Immediate disc count alone is not the objective.";

function serializeBoard(board: Board): string[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) => {
    return board
      .slice(row * BOARD_SIZE, (row + 1) * BOARD_SIZE)
      .map((cell) => (cell === BLACK ? "B" : cell === WHITE ? "W" : "."))
      .join("");
  });
}

function buildJevState({ board, player }: Position) {
  return {
    game: GAME_RULES,
    you: player === BLACK ? "black" : "white",
    legend: "B=black, W=white, .=empty; rows 1-8, columns a-h",
    board: serializeBoard(board),
  };
}

/** Use each legal move as a choice, with its consequences as the description. */
function buildMoveCriteria({ board, player }: Position) {
  return Object.fromEntries(
    getLegalMoves(board, player).map((move) => {
      const nextBoard = applyMove(board, player, move);
      return [
        toCoordinate(move),
        {
          flips: getFlippedDiscs(board, player, move).length,
          opponentLegalMoves: getLegalMoves(nextBoard, opponentOf(player)).map(toCoordinate),
        },
      ];
    }),
  );
}

export function buildJevRequest(position: Position, model: string) {
  return {
    model,
    state: buildJevState(position),
    questions: {
      move: {
        type: "choice",
        instructions: MOVE_INSTRUCTIONS,
        criteria: buildMoveCriteria(position),
      },
    },
  };
}

interface JevResponse {
  model?: string;
  answers?: {
    move?: {
      choice?: string;
      confidence?: number;
      probabilities?: Record<string, number>;
    };
  };
}

export class JevHttpError extends Error {
  constructor(status: number) {
    super(
      `Jev API error (${status}). Check your API key, usage limits, and connection, then retry.`,
    );
  }
}

export async function chooseJevMove(
  position: Position,
  apiKey: string,
  model: string,
): Promise<JevMoveResult> {
  const startedAt = performance.now();
  const response = await fetch(JEV_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildJevRequest(position, model)),
  });
  if (!response.ok) throw new JevHttpError(response.status);

  const data = (await response.json()) as JevResponse;
  const answer = data.answers?.move;
  const move = getLegalMoves(position.board, position.player).find(
    (candidate) => toCoordinate(candidate) === answer?.choice,
  );
  if (move === undefined) throw new Error("Jev returned an illegal move");

  return {
    move,
    elapsed: Math.round(performance.now() - startedAt),
    confidence: answer?.confidence,
    probabilities: answer?.probabilities,
    model: data.model,
  };
}
