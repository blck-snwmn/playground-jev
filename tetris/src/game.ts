const WIDTH = 10;
const HEIGHT = 20;
export const PIECES = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type Piece = (typeof PIECES)[number];
export type Board = number[][];
type Cell = [number, number];
const shapes: Record<Piece, Cell[]> = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};
export interface Pose {
  x: number;
  y: number;
  rotation: number;
}
export interface Position {
  board: Board;
  piece: Piece;
  next: Piece;
  activePose?: Pose;
}
export interface Placement {
  id: string;
  pose: Pose;
  path: Pose[];
  board: Board;
  lines: number;
  holes: number;
  height: number;
  bumpiness: number;
}
export const emptyBoard = (): Board =>
  Array.from({ length: HEIGHT }, () => Array<number>(WIDTH).fill(0));
export function cells(piece: Piece, pose: Pose): Cell[] {
  let result = shapes[piece].map(([x, y]): Cell => [x, y]);
  for (let r = 0; r < pose.rotation; r++)
    result = result.map(([x, y]): Cell => [(piece === "I" ? 3 : 2) - y, x]);
  return result.map(([x, y]) => [x + pose.x, y + pose.y]);
}
export function fits(board: Board, piece: Piece, pose: Pose): boolean {
  return cells(piece, pose).every(
    ([x, y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && board[y][x] === 0,
  );
}
export function lock(board: Board, piece: Piece, pose: Pose): { board: Board; lines: number } {
  if (!fits(board, piece, pose)) throw new Error("Invalid placement");
  const result = board.map((row) => row.slice());
  for (const [x, y] of cells(piece, pose)) result[y][x] = PIECES.indexOf(piece) + 1;
  const remaining = result.filter((row) => row.some((cell) => cell === 0));
  const lines = HEIGHT - remaining.length;
  return {
    board: [...Array.from({ length: lines }, () => Array<number>(WIDTH).fill(0)), ...remaining],
    lines,
  };
}
export function metrics(board: Board) {
  const heights = Array.from({ length: WIDTH }, (_, x) => {
    const top = board.findIndex((row) => row[x] !== 0);
    return top < 0 ? 0 : HEIGHT - top;
  });
  let holes = 0;
  for (let x = 0; x < WIDTH; x++)
    for (let y = HEIGHT - heights[x]; y < HEIGHT; y++) if (board[y][x] === 0) holes++;
  return {
    holes,
    height: Math.max(...heights),
    bumpiness: heights.slice(1).reduce((sum, h, i) => sum + Math.abs(h - heights[i]), 0),
  };
}
/** Reachable placements using left, right, down and clockwise rotation; no wall kicks or hold. */
export function placements({ board, piece, activePose }: Position): Placement[] {
  const start: Pose = activePose ?? { x: 3, y: 0, rotation: 0 };
  if (!fits(board, piece, start)) return [];
  const key = (p: Pose) => `${p.x},${p.y},${p.rotation}`;
  const queue = [{ pose: start, path: [start] }];
  const visited = new Set([key(start)]);
  const landed = new Set<string>();
  const result: Placement[] = [];
  for (let i = 0; i < queue.length; i++) {
    const { pose, path } = queue[i];
    if (!fits(board, piece, { ...pose, y: pose.y + 1 })) {
      const signature = cells(piece, pose)
        .map(([x, y]) => y * WIDTH + x)
        .sort((a, b) => a - b)
        .join(",");
      if (!landed.has(signature)) {
        landed.add(signature);
        const outcome = lock(board, piece, pose);
        result.push({ id: `p${result.length}`, pose, path, ...outcome, ...metrics(outcome.board) });
      }
    }
    const successors = [
      { ...pose, x: pose.x - 1 },
      { ...pose, x: pose.x + 1 },
      { ...pose, y: pose.y + 1 },
      { ...pose, rotation: piece === "O" ? 0 : (pose.rotation + 1) % 4 },
    ];
    for (const next of successors)
      if (!visited.has(key(next)) && fits(board, piece, next)) {
        visited.add(key(next));
        queue.push({ pose: next, path: [...path, next] });
      }
  }
  return result;
}
export function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== "object") return false;
  const p = value as Position;
  return (
    PIECES.includes(p.piece) &&
    PIECES.includes(p.next) &&
    (p.activePose === undefined ||
      (p.activePose !== null &&
        typeof p.activePose === "object" &&
        Number.isSafeInteger(p.activePose.x) &&
        p.activePose.x >= -3 &&
        p.activePose.x < WIDTH &&
        Number.isSafeInteger(p.activePose.y) &&
        p.activePose.y >= -3 &&
        p.activePose.y < HEIGHT &&
        Number.isInteger(p.activePose.rotation) &&
        p.activePose.rotation >= 0 &&
        p.activePose.rotation < 4)) &&
    Array.isArray(p.board) &&
    p.board.length === HEIGHT &&
    p.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === WIDTH &&
        row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 8),
    )
  );
}
export function createBag(random = Math.random): () => Piece {
  let bag: Piece[] = [];
  return () => {
    if (!bag.length) {
      bag = [...PIECES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}

export const OBSTACLE_ROWS = 14;
export const OBSTACLE_MIN_Y = HEIGHT - OBSTACLE_ROWS;
export const LINES_PER_TICKET = 4;
export const PIECES_BETWEEN_TICKETS = 3;
export interface Obstacle {
  piece: Piece;
  rotation: number;
}
export function randomObstacle(random = Math.random): Obstacle {
  const piece = PIECES[Math.floor(random() * PIECES.length)];
  const seen = new Set<string>();
  const rotations: number[] = [];
  for (let rotation = 0; rotation < 4; rotation++) {
    const points = cells(piece, { x: 0, y: 0, rotation });
    const minX = Math.min(...points.map(([x]) => x));
    const minY = Math.min(...points.map(([, y]) => y));
    const signature = points
      .map(([x, y]) => `${x - minX},${y - minY}`)
      .sort()
      .join(";");
    if (!seen.has(signature)) {
      seen.add(signature);
      rotations.push(rotation);
    }
  }
  return { piece, rotation: rotations[Math.floor(random() * rotations.length)] };
}
export function canPlaceObstacle(
  board: Board,
  obstacle: Obstacle,
  pose: Pose,
  active: { piece: Piece; pose: Pose },
): boolean {
  if (pose.rotation !== obstacle.rotation || !fits(board, obstacle.piece, pose)) return false;
  if (cells(obstacle.piece, pose).some(([, y]) => y < OBSTACLE_MIN_Y)) return false;
  const occupied = new Set(cells(active.piece, active.pose).map(([x, y]) => `${x},${y}`));
  return (
    !cells(obstacle.piece, pose).some(([x, y]) => occupied.has(`${x},${y}`)) &&
    !fits(board, obstacle.piece, { ...pose, y: pose.y + 1 })
  );
}
/** Check only the revealed shape, including poses whose local origin is outside the board. */
export function hasObstaclePlacement(
  board: Board,
  obstacle: Obstacle,
  active: { piece: Piece; pose: Pose },
): boolean {
  const points = cells(obstacle.piece, { x: 0, y: 0, rotation: obstacle.rotation });
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  for (let y = -minY; y < HEIGHT - maxY; y++)
    for (let x = -minX; x < WIDTH - maxX; x++)
      if (canPlaceObstacle(board, obstacle, { x, y, rotation: obstacle.rotation }, active))
        return true;
  return false;
}
/** Obstacles are fixed immediately; rows clear only when Jev locks its piece. */
export function placeObstacle(
  board: Board,
  obstacle: Obstacle,
  pose: Pose,
  active: { piece: Piece; pose: Pose },
): Board {
  if (!canPlaceObstacle(board, obstacle, pose, active))
    throw new Error("Invalid obstacle placement");
  const result = board.map((row) => row.slice());
  for (const [x, y] of cells(obstacle.piece, pose)) result[y][x] = 8;
  return result;
}
export type Move = "left" | "right" | "down" | "rotate";
export function pathMoves(path: Pose[]): Move[] {
  return path.slice(1).map((pose, i) => {
    const previous = path[i];
    if (pose.x !== previous.x) return pose.x < previous.x ? "left" : "right";
    if (pose.y !== previous.y) return "down";
    return "rotate";
  });
}
export function stepMove(board: Board, piece: Piece, pose: Pose, move: Move) {
  const next = { ...pose };
  if (move === "left") next.x--;
  if (move === "right") next.x++;
  if (move === "down") next.y++;
  if (move === "rotate") next.rotation = piece === "O" ? 0 : (pose.rotation + 1) % 4;
  const allowed = fits(board, piece, next);
  return { pose: allowed ? next : pose, landed: !allowed && move === "down" };
}
