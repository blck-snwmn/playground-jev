import { PIECES, cells, createBag, emptyBoard, placements, type Pose, type Position } from "./game";
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>("board");
const context = canvas.getContext("2d")!;
const preview = element<HTMLCanvasElement>("next").getContext("2d")!;
const toggle = element<HTMLButtonElement>("toggle");
const status = element("status");
const colors = [
  "#152854",
  "#6fdcec",
  "#ffda73",
  "#c3a2ff",
  "#83dea8",
  "#ff8f9c",
  "#7ea4ff",
  "#ffb47b",
];
let gameId = crypto.randomUUID();
let drawPiece = createBag();
let position: Position = { board: emptyBoard(), piece: drawPiece(), next: drawPiece() };
let running = false,
  configured = false,
  gameOver = false,
  busy = false,
  epoch = 0,
  totalLines = 0,
  totalPieces = 0;
let controller: AbortController | undefined;
function paint(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, size: number) {
  ctx.fillStyle = colors[color];
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  if (color) {
    ctx.fillStyle = "#ffffff45";
    ctx.fillRect(x * size + 3, y * size + 3, size - 6, 3);
  }
}
function render(pose: Pose = { x: 3, y: 0, rotation: 0 }) {
  context.clearRect(0, 0, 300, 600);
  position.board.forEach((row, y) => row.forEach((c, x) => paint(context, x, y, c, 30)));
  const color = PIECES.indexOf(position.piece) + 1;
  for (const [x, y] of cells(position.piece, pose)) paint(context, x, y, color, 30);
  preview.clearRect(0, 0, 120, 80);
  for (const [x, y] of cells(position.next, { x: 0, y: 0, rotation: 0 }))
    paint(preview, x, y, PIECES.indexOf(position.next) + 1, 26);
  element("lines").textContent = String(totalLines);
  element("pieces").textContent = String(totalPieces);
}
function buttons() {
  toggle.textContent = gameOver
    ? "Game over"
    : running
      ? "Pause"
      : totalPieces
        ? "Resume"
        : "Start watching";
  toggle.disabled = !configured || gameOver;
}
async function recordEvent(type: "placed" | "game_over", requestId?: string) {
  const response = await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...position,
      gameId,
      turn: type === "placed" ? totalPieces : totalPieces + 1,
      type,
      requestId,
      totalLines,
    }),
  });
  if (!response.ok) throw new Error("Could not save the log. Check disk space and the server.");
}
async function play() {
  if (busy || !running || gameOver) return;
  busy = true;
  const version = epoch;
  try {
    while (running && version === epoch) {
      const candidates = placements(position);
      if (!candidates.length) {
        gameOver = true;
        running = false;
        buttons();
        await recordEvent("game_over");
        if (version !== epoch) return;
        status.textContent = "Game over. Select New game to start again.";
        break;
      }
      status.textContent = "Jev is choosing a placement…";
      controller = new AbortController();
      const response = await fetch("/api/jev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...position, gameId, turn: totalPieces + 1 }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        choice?: string;
        elapsed?: number;
        error?: string;
        requestId?: string;
      };
      if (version !== epoch) return;
      if (!response.ok) throw new Error(data.error || "Could not get a decision from Jev.");
      const choice = candidates.find((p) => p.id === data.choice);
      if (!choice) throw new Error("Could not read the placement. Resume to retry.");
      element("elapsed").textContent = `${((data.elapsed || 0) / 1000).toFixed(2)} s`;
      status.textContent = running
        ? "Moving to the chosen placement."
        : "Pausing after this piece is placed.";
      for (const pose of choice.path) {
        if (version !== epoch) return;
        render(pose);
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : Number(element<HTMLSelectElement>("speed").value),
          ),
        );
      }
      if (version !== epoch) return;
      totalLines += choice.lines;
      totalPieces++;
      position = { board: choice.board, piece: position.next, next: drawPiece() };
      render();
      await recordEvent("placed", data.requestId);
      if (version !== epoch) return;
      if (!running) status.textContent = "Paused.";
    }
  } catch (error) {
    if (version === epoch) {
      running = false;
      status.textContent =
        error instanceof Error ? error.message : "Connection failed. Resume to retry.";
    }
  } finally {
    busy = false;
    buttons();
    if (running) void play();
  }
}
toggle.addEventListener("click", () => {
  if (gameOver) return;
  running = !running;
  buttons();
  if (running) void play();
  else status.textContent = "Pausing after this piece is placed.";
});
element("reset").addEventListener("click", () => {
  epoch++;
  gameOver = false;
  gameId = crypto.randomUUID();
  running = false;
  controller?.abort();
  drawPiece = createBag();
  position = { board: emptyBoard(), piece: drawPiece(), next: drawPiece() };
  totalLines = 0;
  totalPieces = 0;
  element("elapsed").textContent = "—";
  status.textContent = configured
    ? "Ready to watch."
    : "Configure JEV_API_KEY in tetris/.env and restart the server.";
  render();
  buttons();
});
render();
void fetch("/api/status")
  .then(async (response) => {
    if (!response.ok) throw new Error();
    const data = (await response.json()) as { configured: boolean };
    configured = data.configured;
    status.textContent = configured
      ? "Ready to watch."
      : "Configure JEV_API_KEY in tetris/.env and restart the server.";
    buttons();
  })
  .catch(() => {
    status.textContent = "Could not connect to the server. Reload to retry.";
  });
