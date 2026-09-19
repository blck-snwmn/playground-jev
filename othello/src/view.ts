import {
  BLACK,
  WHITE,
  BOARD_SIZE,
  countDiscs,
  getLegalMoves,
  toCoordinate,
  type Cell,
  type Player,
} from "./game";
import { isJevTurn, type Controller, type HistoryEntry, type MatchState } from "./match";
import type { JevMoveResult } from "./jev";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element: ${id}`);
  return found as T;
}

export const elements = {
  board: element<HTMLDivElement>("board"),
  blackScore: element<HTMLElement>("black-score"),
  whiteScore: element<HTMLElement>("white-score"),
  blackName: element<HTMLElement>("black-name"),
  whiteName: element<HTMLElement>("white-name"),
  moveCount: element<HTMLElement>("move-count"),
  totalRequests: element<HTMLElement>("total-time"),
  status: element<HTMLElement>("status"),
  connection: element<HTMLElement>("connection"),
  mode: element<HTMLSelectElement>("mode"),
  color: element<HTMLSelectElement>("color"),
  start: element<HTMLButtonElement>("new"),
  pause: element<HTMLButtonElement>("pause"),
  step: element<HTMLButtonElement>("step"),
  error: element<HTMLElement>("error"),
  history: element<HTMLOListElement>("log"),
  emptyHistory: element<HTMLElement>("empty"),
};

const playerName = (player: Player) => (player === BLACK ? "Black" : "White");
const controllerName = (controller: Controller) => (controller === "human" ? "Human" : "Jev");

function describeCell(cell: Cell, legal: boolean): string {
  if (cell !== 0) return playerName(cell);
  return legal ? "Legal move" : "Empty";
}

function renderBoard(state: MatchState, onMove: (move: number) => void): void {
  const legalMoves =
    state.currentPlayer === null ? [] : getLegalMoves(state.board, state.currentPlayer);
  const canPlay = state.active && !state.thinking && !isJevTurn(state);
  const cells = state.board.map((value, index) => {
    const legal = legalMoves.includes(index);
    const cell = document.createElement("button");
    cell.className = index === state.lastMove ? "cell last" : "cell";
    cell.disabled = !canPlay || !legal;
    cell.setAttribute("aria-label", `${toCoordinate(index)} ${describeCell(value, legal)}`);
    if (index % BOARD_SIZE === 0) cell.dataset.row = String(Math.floor(index / BOARD_SIZE) + 1);

    if (value !== 0) {
      const stone = document.createElement("span");
      stone.className = `disc ${value === BLACK ? "black" : "white"}`;
      cell.append(stone);
    } else if (legal) {
      const dot = document.createElement("span");
      dot.className = "dot";
      cell.append(dot);
    }
    cell.onclick = () => onMove(index);
    return cell;
  });
  elements.board.replaceChildren(...cells);
}

function statusMessage(state: MatchState): string {
  if (!state.active) return "";
  if (state.currentPlayer === null) {
    const score = countDiscs(state.board);
    if (score.black === score.white) return "Draw";
    return `${score.black > score.white ? "Black" : "White"} wins!`;
  }
  const player = state.currentPlayer;
  const turn = `${playerName(player)} to move / ${controllerName(state.controllers[player])}`;
  if (state.thinking) return `${turn} is thinking…`;
  if (state.paused && isJevTurn(state)) return `${turn} (paused)`;
  return turn;
}

function describeJevResult(result: JevMoveResult): string {
  const confidence =
    typeof result.confidence === "number"
      ? `Confidence ${Math.round(result.confidence * 100)}%`
      : "Confidence unavailable";
  const candidates = Object.entries(result.probabilities || {})
    .filter(([, probability]) => typeof probability === "number")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([move, probability]) => `${move}: ${Math.round(probability * 100)}%`)
    .join(" / ");

  const lines = [`${result.elapsed} ms · ${confidence}`];
  if (candidates) lines.push(`Candidates: ${candidates}`);
  if (result.model) lines.push(result.model);
  return lines.join("\n");
}

function renderHistoryEntry(entry: HistoryEntry): HTMLLIElement {
  const item = document.createElement("li");
  const title = document.createElement("span");
  if (entry.type === "pass") {
    title.textContent = `${playerName(entry.player)} passes (no legal moves)`;
  } else {
    title.textContent = `${entry.number}. ${playerName(entry.player)} ${controllerName(entry.controller)} → ${toCoordinate(entry.move)}`;
  }
  item.append(title);
  if (entry.type === "move" && entry.result) {
    const details = document.createElement("small");
    details.textContent = describeJevResult(entry.result);
    item.append(details);
  }
  return item;
}

export function renderMatch(state: MatchState, onMove: (move: number) => void): void {
  const score = countDiscs(state.board);
  elements.blackScore.textContent = String(score.black);
  elements.whiteScore.textContent = String(score.white);
  elements.blackName.textContent = controllerName(state.controllers[BLACK]);
  elements.whiteName.textContent = controllerName(state.controllers[WHITE]);
  elements.moveCount.textContent = `${state.moveCount} moves`;
  elements.totalRequests.textContent = `Jev requests: ${state.jevRequests}`;
  elements.status.textContent = statusMessage(state);
  elements.error.textContent = state.error;

  const hasJev = Object.values(state.controllers).includes("jev");
  elements.pause.disabled = !state.active || state.currentPlayer === null || !hasJev;
  elements.pause.textContent = state.paused ? "Resume" : "Pause";
  elements.step.disabled = !state.active || !state.paused || !isJevTurn(state) || state.thinking;
  elements.emptyHistory.hidden = state.history.length > 0;
  elements.history.replaceChildren(...state.history.toReversed().map(renderHistoryEntry));
  renderBoard(state, onMove);
}
