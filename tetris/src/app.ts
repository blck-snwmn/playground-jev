import {
  PIECES,
  cells,
  createBag,
  emptyBoard,
  moveCandidates,
  applyHold,
  advancePiece,
  spawnPose,
  lock,
  pathMoves,
  stepMove,
  canPlaceObstacle,
  hasObstaclePlacement,
  placeObstacle,
  randomObstacle,
  LINES_PER_TICKET,
  PIECES_BETWEEN_TICKETS,
  OBSTACLE_ROWS,
  OBSTACLE_MIN_Y,
  type Obstacle,
  type Pose,
  type Position,
} from "./game";
const MOVE_INTERVAL_MS = 50;
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
  "#b9becd",
];
let gameId = crypto.randomUUID();
let drawPiece = createBag();
let position: Position = {
  board: emptyBoard(),
  piece: drawPiece(),
  next: drawPiece(),
  nextAfter: drawPiece(),
  hold: null,
  canHold: true,
};
let running = false,
  configured = false,
  gameOver = false,
  busy = false,
  epoch = 0,
  totalLines = 0,
  totalPieces = 0;
let controller: AbortController | undefined;
let activePose = spawnPose();
let tickets: Obstacle[] = [];
let placingObstacle = false;
let obstacleBlocked = false;
let replanning = false;
let dragging = false;
let cooldownRemaining = 0;
let ghost: Pose | undefined;
const obstacleCanvas = element<HTMLCanvasElement>("obstacle");
const obstacleContext = obstacleCanvas.getContext("2d")!;
const useTicket = element<HTMLButtonElement>("use-ticket");
const discardTicket = element<HTMLButtonElement>("discard-ticket");
function renderObstacle() {
  obstacleContext.clearRect(0, 0, 120, 120);
  const obstacle = tickets[0];
  obstacleCanvas.hidden = !placingObstacle;
  element("obstacle-concealed").hidden = placingObstacle;
  if (placingObstacle && obstacle)
    for (const [x, y] of cells(obstacle.piece, { x: 0, y: 0, rotation: obstacle.rotation }))
      paint(obstacleContext, x, y, 8, 28);
  element("obstacle-range").textContent = `Obstacles: bottom ${OBSTACLE_ROWS} rows only`;
  element("tickets").textContent = String(tickets.length);
  element("ticket-progress").textContent =
    `${totalLines % LINES_PER_TICKET} / ${LINES_PER_TICKET} lines toward next ticket`;
  useTicket.disabled =
    !running || gameOver || placingObstacle || !tickets.length || cooldownRemaining > 0;
  useTicket.hidden = placingObstacle && obstacleBlocked;
  discardTicket.hidden = !placingObstacle || !obstacleBlocked;
  useTicket.textContent = placingObstacle ? "Placing obstacle…" : "Use ticket";
  element("ticket-cooldown").textContent =
    cooldownRemaining > 0
      ? `Next ticket in ${cooldownRemaining} Jev ${cooldownRemaining === 1 ? "piece" : "pieces"}`
      : placingObstacle
        ? "Time stopped"
        : tickets.length
          ? "Ticket ready"
          : "Earn a ticket by clearing lines";
  element("obstacle-help").textContent = placingObstacle
    ? obstacleBlocked
      ? "No room in the allowed area. Discarding consumes 1 ticket."
      : "Drag onto the floor or stack. Place the obstacle to resume."
    : "Use a ticket to stop time and reveal its shape.";
  obstacleCanvas.setAttribute("aria-disabled", String(!placingObstacle || obstacleBlocked));
}
useTicket.addEventListener("click", () => {
  if (!running || gameOver || placingObstacle || !tickets.length || cooldownRemaining > 0) return;
  placingObstacle = true;
  obstacleBlocked = !hasObstaclePlacement(position.board, tickets[0], {
    piece: position.piece,
    pose: activePose,
  });
  ghost = undefined;
  render();
  buttons();
});
function finishObstacle() {
  tickets.shift();
  cooldownRemaining = PIECES_BETWEEN_TICKETS;
  placingObstacle = false;
  obstacleBlocked = false;
  dragging = false;
  ghost = undefined;
  render();
  buttons();
}
discardTicket.addEventListener("click", () => {
  if (!placingObstacle || !obstacleBlocked || !tickets.length) return;
  finishObstacle();
  toggle.focus();
});
function updateGhost(event: PointerEvent) {
  const obstacle = tickets[0];
  if (!obstacle) return;
  const rect = canvas.getBoundingClientRect();
  const points = cells(obstacle.piece, { x: 0, y: 0, rotation: obstacle.rotation });
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  ghost = {
    x: Math.floor(((event.clientX - rect.left) * 10) / rect.width) - Math.floor((minX + maxX) / 2),
    y: Math.floor(((event.clientY - rect.top) * 20) / rect.height) - Math.floor((minY + maxY) / 2),
    rotation: obstacle.rotation,
  };
  render();
}
obstacleCanvas.addEventListener("pointerdown", (event) => {
  if (!placingObstacle || obstacleBlocked || gameOver || !tickets.length) return;
  event.preventDefault();
  dragging = true;
  obstacleCanvas.setPointerCapture(event.pointerId);
  updateGhost(event);
});
canvas.addEventListener("pointerdown", (event) => {
  if (!dragging) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  updateGhost(event);
});
window.addEventListener("pointermove", (event) => {
  if (dragging) updateGhost(event);
});
window.addEventListener("pointerup", (event) => {
  if (!dragging || !tickets[0]) return;
  updateGhost(event);
  if (
    !ghost ||
    !canPlaceObstacle(position.board, tickets[0], ghost, {
      piece: position.piece,
      pose: activePose,
    })
  )
    return;
  position = {
    ...position,
    board: placeObstacle(position.board, tickets[0], ghost, {
      piece: position.piece,
      pose: activePose,
    }),
  };
  replanning = true;
  controller?.abort();
  status.textContent = "Jev is reconsidering after the obstacle…";
  finishObstacle();
});
async function waitForPlacement(version: number) {
  while (placingObstacle && version === epoch)
    await new Promise((resolve) => setTimeout(resolve, 16));
}
async function tick(version: number) {
  await new Promise((resolve) => setTimeout(resolve, MOVE_INTERVAL_MS));
  await waitForPlacement(version);
}
function paint(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, size: number) {
  ctx.fillStyle = colors[color];
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  if (color) {
    ctx.fillStyle = "#ffffff45";
    ctx.fillRect(x * size + 3, y * size + 3, size - 6, 3);
  }
}
function render(pose: Pose = activePose) {
  context.clearRect(0, 0, 300, 600);
  position.board.forEach((row, y) =>
    row.forEach((c, x) => {
      paint(context, x, y, c, 30);
      if (!c && y < OBSTACLE_MIN_Y) {
        context.fillStyle = "#303552";
        context.fillRect(x * 30 + 1, y * 30 + 1, 28, 28);
      }
    }),
  );
  context.save();
  context.strokeStyle = "#a5b8dd";
  context.lineWidth = 2;
  context.setLineDash([6, 4]);
  context.beginPath();
  context.moveTo(0, OBSTACLE_MIN_Y * 30);
  context.lineTo(300, OBSTACLE_MIN_Y * 30);
  context.stroke();
  context.restore();
  const color = PIECES.indexOf(position.piece) + 1;
  for (const [x, y] of cells(position.piece, pose)) paint(context, x, y, color, 30);
  if (dragging && ghost && tickets[0]) {
    const valid = canPlaceObstacle(position.board, tickets[0], ghost, {
      piece: position.piece,
      pose: activePose,
    });
    context.save();
    context.globalAlpha = 0.65;
    context.fillStyle = valid ? "#a4ffcb" : "#ff687f";
    for (const [x, y] of cells(tickets[0].piece, ghost))
      context.fillRect(x * 30 + 1, y * 30 + 1, 28, 28);
    context.restore();
  }
  renderObstacle();
  preview.clearRect(0, 0, 120, 80);
  for (const [x, y] of cells(position.next, { x: 0, y: 0, rotation: 0 }))
    paint(preview, x, y, PIECES.indexOf(position.next) + 1, 26);
  const holdCanvas = element<HTMLCanvasElement>("hold");
  const held = holdCanvas.getContext("2d")!;
  held.clearRect(0, 0, 120, 80);
  if (position.hold) {
    for (const [x, y] of cells(position.hold, { x: 0, y: 0, rotation: 0 }))
      paint(held, x, y, PIECES.indexOf(position.hold) + 1, 26);
  } else {
    held.fillStyle = "#c4d2f4";
    held.font = "18px sans-serif";
    held.fillText("Empty", 12, 40);
  }
  holdCanvas.setAttribute(
    "aria-label",
    `Hold: ${position.hold ?? "empty"}. ${position.canHold ? "Available" : "Used this turn"}`,
  );
  element("hold-slot").classList.toggle("hold-used", !position.canHold);
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
  toggle.disabled = !configured || gameOver || placingObstacle;
  renderObstacle();
}
async function recordEvent(type: "placed" | "game_over", requestId?: string) {
  const response = await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...position,
      activePose,
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
      await waitForPlacement(version);
      if (version !== epoch || !running) return;
      let requestId: string | undefined;
      decisions: while (true) {
        await waitForPlacement(version);
        if (version !== epoch) return;
        const snapshot = { ...position, activePose: { ...activePose } };
        const candidates = moveCandidates(snapshot);
        if (!candidates.length) {
          gameOver = true;
          running = false;
          buttons();
          await recordEvent("game_over");
          if (version !== epoch) return;
          status.textContent = "Game over. Select New game to start again.";
          return;
        }
        status.textContent = replanning
          ? "Jev is reconsidering after the obstacle…"
          : "Jev is choosing a placement…";
        controller = new AbortController();
        let response: Response;
        let data: { choice?: string; elapsed?: number; error?: string; requestId?: string };
        try {
          response = await fetch("/api/jev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, gameId, turn: totalPieces + 1 }),
            signal: controller.signal,
          });
          data = (await response.json()) as typeof data;
        } catch (error) {
          if (version !== epoch) return;
          if (position.board !== snapshot.board) continue decisions;
          throw error;
        }
        if (version !== epoch) return;
        await waitForPlacement(version);
        if (version !== epoch) return;
        if (position.board !== snapshot.board) continue decisions;
        if (!response.ok) throw new Error(data.error || "Could not get a decision from Jev.");
        const choice = candidates.find((p) => p.id === data.choice);
        if (!choice) throw new Error("Could not read the placement. Resume to retry.");
        if (choice.useHold) {
          position = applyHold({ ...position, activePose }, drawPiece);
          activePose = spawnPose();
          render();
        }
        requestId = data.requestId;
        replanning = false;
        element("elapsed").textContent = `${((data.elapsed || 0) / 1000).toFixed(2)} s`;
        status.textContent = running
          ? "Moving to the chosen placement."
          : "Pausing after this piece is placed.";
        // Never execute an operation from a decision made before the latest obstacle.
        const moves = pathMoves(choice.path);
        let moveIndex = 0;
        while (true) {
          await tick(version);
          if (version !== epoch) return;
          if (position.board !== snapshot.board) continue decisions;
          const step = stepMove(
            position.board,
            position.piece,
            activePose,
            moves[moveIndex++] ?? "down",
          );
          activePose = step.pose;
          render();
          if (step.landed) break;
        }
        break;
      }
      const outcome = lock(position.board, position.piece, activePose);
      const earned =
        Math.floor((totalLines + outcome.lines) / LINES_PER_TICKET) -
        Math.floor(totalLines / LINES_PER_TICKET);
      for (let i = 0; i < earned; i++) tickets.push(randomObstacle());
      totalLines += outcome.lines;
      totalPieces++;
      cooldownRemaining = Math.max(0, cooldownRemaining - 1);
      position = advancePiece(position, outcome.board, drawPiece);
      activePose = spawnPose();
      render();
      await recordEvent("placed", requestId);
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
  if (gameOver || placingObstacle) return;
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
  position = {
    board: emptyBoard(),
    piece: drawPiece(),
    next: drawPiece(),
    nextAfter: drawPiece(),
    hold: null,
    canHold: true,
  };
  placingObstacle = false;
  obstacleBlocked = false;
  replanning = false;
  dragging = false;
  cooldownRemaining = 0;
  ghost = undefined;
  tickets = [];
  activePose = spawnPose();
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
