import { fits, metrics, type Placement, type Position } from "./game";
export function buildJevRequest(position: Position, model: string, candidates: Placement[]) {
  const currentMetrics = metrics(position.board);
  return {
    model,
    state: {
      game: "Tetris on a 10x20 board. Choose a reachable placement. Full rows clear. Survive and clear as many lines as possible. No hold or wall kicks.",
      board: position.board.map((row) => row.map((c) => (c ? "#" : ".")).join("")),
      legend: "Rows run top to bottom. # occupied, . empty.",
      piece: position.piece,
      next: position.next,
      currentMetrics,
      metricGuide:
        "holes counts empty cells with an occupied cell above in the same column; height is maximum column height; bumpiness is the sum of adjacent column height differences. Candidate metrics are measured after placement and line clears. delta is candidate minus current: positive means an increase. lines counts rows cleared by this move. nextCanSpawn indicates whether the next piece fits at its spawn position after this placement and line clears, assuming no further obstacles are added; false means immediate game over on the next turn.",
    },
    questions: {
      move: {
        type: "choice",
        instructions:
          "Choose a placement to survive and clear lines. Survival takes priority over all other metrics: if any candidate has nextCanSpawn=true, choose one of those candidates. When the stack is high and space near the top is limited, prioritize line clears and keeping stack height low over making the surface flatter; accept a modest increase in holes if needed to avoid a dangerous increase in height. Otherwise, prioritize avoiding an increase in buried holes over making the surface flatter. Do not create buried holes merely to reduce bumpiness. Compare each candidate with currentMetrics using delta; apply the survival and high-stack priorities first, then prefer preserving or reducing holes and consider line clears, stack height, and surface shape. Consider the next piece.",
        criteria: Object.fromEntries(
          candidates.map((p) => [
            p.id,
            {
              nextCanSpawn: fits(p.board, position.next, { x: 3, y: 0, rotation: 0 }),
              lines: p.lines,
              holes: p.holes,
              height: p.height,
              bumpiness: p.bumpiness,
              delta: {
                holes: p.holes - currentMetrics.holes,
                height: p.height - currentMetrics.height,
                bumpiness: p.bumpiness - currentMetrics.bumpiness,
              },
              board: p.board.map((row) => row.map((c) => (c ? "#" : ".")).join("")),
            },
          ]),
        ),
      },
    },
  };
}
export async function chooseMove(request: ReturnType<typeof buildJevRequest>, apiKey: string) {
  const start = performance.now();
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error("Jev request failed");
  const data: unknown = await response.json();
  const choice = (data as { answers?: { move?: { choice?: unknown } } })?.answers?.move?.choice;
  if (typeof choice !== "string" || !Object.hasOwn(request.questions.move.criteria, choice))
    throw new Error("Invalid Jev choice");
  return { choice, elapsed: Math.round(performance.now() - start) };
}
