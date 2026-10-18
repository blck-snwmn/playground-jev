import { DEFAULT_JEV_MODEL, JEV_MODELS, isJevModel, downloadJson } from "@playground-jev/common";
import { BLACK, WHITE, createInitialBoard, type Position } from "./game";
import type { JevMoveResult } from "./jev";
import { MatchController, type MatchMode } from "./match";
import { elements, renderMatch } from "./view";

let jevConfigured = false;
let activeModel = DEFAULT_JEV_MODEL;
for (const model of JEV_MODELS) elements.model.add(new Option(model, model));
const match = new MatchController(requestJevMove, (state) => {
  renderMatch(state, (move) => match.playHumanMove(move));
});

function startMatch(): void {
  const mode = elements.mode.value as MatchMode;
  if (mode !== "human-human" && !jevConfigured) {
    elements.error.textContent =
      "Configure JEV_API_KEY in othello/.env, restart the server, and reload this page. Human vs Human works without an API key.";
    return;
  }
  const humanColor = elements.color.value === String(BLACK) ? BLACK : WHITE;
  const model = elements.model.value;
  if (!isJevModel(model)) return;
  activeModel = model;
  elements.gameModel.textContent = mode === "human-human" ? "" : `Current game: ${activeModel}`;
  match.start(mode, humanColor);
}

async function requestJevMove(position: Position, signal: AbortSignal): Promise<JevMoveResult> {
  const response = await fetch("/api/jev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...position, model: activeModel }),
    signal,
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error || "The request failed.");
  }
  return response.json() as Promise<JevMoveResult>;
}

async function checkConnection(): Promise<void> {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Cannot connect to the server");
    const status = (await response.json()) as { configured: boolean };
    jevConfigured = status.configured;
    elements.connection.textContent = jevConfigured
      ? "Jev configured"
      : "Jev API key not configured";
  } catch {
    elements.connection.textContent = "Cannot connect to the server";
  }
}

// Connect UI events to match actions.
elements.start.onclick = startMatch;
elements.download.onclick = () =>
  downloadJson("othello-game.json", {
    schema: 1,
    exportedAt: new Date().toISOString(),
    requestedModel: activeModel,
    initialBoard: createInitialBoard(),
    ...match.state,
  });
elements.pause.onclick = () => match.togglePause();
elements.step.onclick = () => void match.step();
elements.mode.onchange = () => {
  elements.color.disabled = elements.mode.value !== "human-jev";
};

renderMatch(match.state, (move) => match.playHumanMove(move));
void checkConnection();
