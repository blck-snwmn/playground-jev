import {
  BLACK,
  WHITE,
  applyMove,
  createInitialBoard,
  getNextPlayer,
  opponentOf,
  type Board,
  type Player,
  type Position,
} from "./game";
import type { JevMoveResult } from "./jev";

export type MatchMode = "human-jev" | "jev-jev" | "human-human";
export type Controller = "human" | "jev";
export type HistoryEntry =
  | {
      type: "move";
      number: number;
      player: Player;
      controller: Controller;
      move: number;
      result?: JevMoveResult;
    }
  | { type: "pass"; player: Player };

export interface MatchState {
  board: Board;
  currentPlayer: Player | null;
  active: boolean;
  paused: boolean;
  thinking: boolean;
  controllers: Record<Player, Controller>;
  moveCount: number;
  jevRequests: number;
  lastMove: number | null;
  history: HistoryEntry[];
  error: string;
}

export type RequestJevMove = (position: Position, signal: AbortSignal) => Promise<JevMoveResult>;
const AUTO_MOVE_DELAY_MS = 450;

function createControllers(mode: MatchMode, humanColor: Player): Record<Player, Controller> {
  const controllerFor = (player: Player): Controller => {
    if (mode === "human-human") return "human";
    if (mode === "human-jev" && player === humanColor) return "human";
    return "jev";
  };
  return { [BLACK]: controllerFor(BLACK), [WHITE]: controllerFor(WHITE) };
}

function createMatchState(controllers: Record<Player, Controller>, active = false): MatchState {
  return {
    board: createInitialBoard(),
    currentPlayer: BLACK,
    active,
    paused: false,
    thinking: false,
    controllers,
    moveCount: 0,
    jevRequests: 0,
    lastMove: null,
    history: [],
    error: "",
  };
}

export function isJevTurn(state: MatchState): boolean {
  return state.currentPlayer !== null && state.controllers[state.currentPlayer] === "jev";
}

/** Manages turns and asynchronous moves independently of the DOM and HTTP. */
export class MatchController {
  state = createMatchState(createControllers("human-jev", BLACK));
  private matchId = 0;
  private pendingRequest?: AbortController;
  private nextMoveTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly requestJevMove: RequestJevMove,
    private readonly onChange: (state: MatchState) => void,
  ) {}

  start(mode: MatchMode, humanColor: Player): void {
    // Use the match ID to discard stale responses even if cancellation arrives too late.
    this.matchId++;
    this.pendingRequest?.abort();
    clearTimeout(this.nextMoveTimer);
    this.state = createMatchState(createControllers(mode, humanColor), true);
    this.onChange(this.state);
    void this.advanceJev();
  }

  playHumanMove(move: number): void {
    if (!this.state.active || this.state.thinking || isJevTurn(this.state)) return;
    this.commitMove(move);
    void this.advanceJev();
  }

  togglePause(): void {
    this.state.paused = !this.state.paused;
    this.onChange(this.state);
    if (!this.state.paused) void this.advanceJev();
  }

  step(): Promise<void> {
    return this.advanceJev(true);
  }

  private commitMove(move: number, result?: JevMoveResult): void {
    const state = this.state;
    const player = state.currentPlayer;
    if (player === null) return;

    state.board = applyMove(state.board, player, move);
    state.lastMove = move;
    state.moveCount++;
    state.history.push({
      type: "move",
      number: state.moveCount,
      player,
      controller: state.controllers[player],
      move,
      result,
    });

    state.currentPlayer = getNextPlayer(state.board, player);
    if (state.currentPlayer === player) {
      state.history.push({ type: "pass", player: opponentOf(player) });
    }
    this.onChange(this.state);
  }

  private async advanceJev(singleStep = false): Promise<void> {
    const state = this.state;
    if (!state.active || state.thinking || !isJevTurn(state)) return;
    if (state.paused && !singleStep) return;
    if (state.currentPlayer === null) return;

    clearTimeout(this.nextMoveTimer);
    const requestMatchId = this.matchId;
    const abortController = new AbortController();
    this.pendingRequest = abortController;
    state.thinking = true;
    state.error = "";
    this.onChange(this.state);

    try {
      const result = await this.requestJevMove(
        { board: state.board, player: state.currentPlayer },
        abortController.signal,
      );
      if (requestMatchId !== this.matchId) return;
      state.jevRequests++;
      this.commitMove(result.move, result);
    } catch (error) {
      if (requestMatchId !== this.matchId) return;
      state.paused = true;
      const message = error instanceof Error ? error.message : "The request failed.";
      state.error = `${message} Select Resume to retry.`;
    } finally {
      if (requestMatchId === this.matchId) {
        state.thinking = false;
        this.onChange(this.state);
        // Check the current pause state: play may have resumed while a single move was pending.
        if (!state.paused && isJevTurn(state)) {
          this.nextMoveTimer = setTimeout(() => {
            if (requestMatchId === this.matchId) void this.advanceJev();
          }, AUTO_MOVE_DELAY_MS);
        }
      }
    }
  }
}
