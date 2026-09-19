import { afterEach, describe, expect, jest, test } from "bun:test";
import { BLACK, WHITE, countDiscs, createInitialBoard, getLegalMoves } from "./game";
import { MatchController, type RequestJevMove } from "./match";
import type { JevMoveResult } from "./jev";

function pendingMove() {
  let resolve!: (result: JevMoveResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<JevMoveResult>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

// Flush promise-driven turn updates without real timers or external API calls.
async function settleResponse() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => jest.useRealTimers());

describe("Match progression", () => {
  test("updates discs, turns, and history after a human move", () => {
    const match = new MatchController(
      async () => {
        throw new Error("Jev must not be called");
      },
      () => {},
    );
    match.start("human-human", BLACK);
    match.playHumanMove(19);
    expect(countDiscs(match.state.board)).toEqual({ black: 4, white: 1 });
    expect(match.state.currentPlayer).toBe(WHITE);
    expect(match.state.history).toEqual([
      { type: "move", number: 1, player: BLACK, controller: "human", move: 19 },
    ]);
  });

  test("lets Jev play first when the human is white and ignores human moves while thinking", async () => {
    const pending = pendingMove();
    const match = new MatchController(
      () => pending.promise,
      () => {},
    );
    match.start("human-jev", WHITE);
    expect(match.state.thinking).toBe(true);
    match.playHumanMove(26);
    expect(match.state.moveCount).toBe(0);
    pending.resolve({ move: 19, elapsed: 10 });
    await settleResponse();
    expect(match.state.currentPlayer).toBe(WHITE);
    expect(match.state.moveCount).toBe(1);
    expect(match.state.thinking).toBe(false);
  });

  test("ignores stale responses after a new game starts", async () => {
    const pending = pendingMove();
    let signal: AbortSignal | undefined;
    const match = new MatchController(
      (_, requestSignal) => {
        signal = requestSignal;
        return pending.promise;
      },
      () => {},
    );
    match.start("human-jev", WHITE);
    match.start("human-human", BLACK);
    expect(signal?.aborted).toBe(true);
    pending.resolve({ move: 19, elapsed: 10 });
    await settleResponse();
    expect(match.state.board).toEqual(createInitialBoard());
    expect(match.state.moveCount).toBe(0);
    expect(match.state.history).toEqual([]);
    expect(match.state.thinking).toBe(false);
  });

  test("finishes the pending move before pausing and allows one move at a time", async () => {
    jest.useFakeTimers();
    const first = pendingMove();
    const second = pendingMove();
    let calls = 0;
    const match = new MatchController(
      () => (++calls === 1 ? first.promise : second.promise),
      () => {},
    );
    match.start("jev-jev", BLACK);
    match.togglePause();
    first.resolve({ move: 19, elapsed: 10 });
    await settleResponse();
    jest.advanceTimersByTime(1000);
    expect(calls).toBe(1);
    expect(match.state.moveCount).toBe(1);
    const step = match.step();
    second.resolve({ move: 18, elapsed: 10 });
    await step;
    jest.advanceTimersByTime(1000);
    expect(calls).toBe(2);
    expect(match.state.moveCount).toBe(2);
    expect(match.state.paused).toBe(true);
  });

  test("continues automatic play when resumed during a pending single move", async () => {
    jest.useFakeTimers();
    const first = pendingMove();
    const second = pendingMove();
    const third = pendingMove();
    const responses = [first, second, third];
    let calls = 0;
    const match = new MatchController(
      () => responses[calls++].promise,
      () => {},
    );

    match.start("jev-jev", BLACK);
    match.togglePause();
    first.resolve({ move: 19, elapsed: 10 });
    await settleResponse();

    const step = match.step();
    match.togglePause();
    expect(match.state.paused).toBe(false);
    expect(match.state.thinking).toBe(true);
    expect(calls).toBe(2);

    second.resolve({ move: 18, elapsed: 10 });
    await step;
    jest.advanceTimersByTime(450);
    expect(calls).toBe(3);
    expect(match.state.thinking).toBe(true);

    // Verify the next response is applied, then stop automatic play to finish the test.
    match.togglePause();
    const move = getLegalMoves(match.state.board, BLACK)[0];
    third.resolve({ move, elapsed: 10 });
    await settleResponse();
    expect(match.state.moveCount).toBe(3);
    expect(match.state.thinking).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(calls).toBe(3);
  });

  test("pauses on request failure and retries the same position on resume", async () => {
    let calls = 0;
    const match = new MatchController(
      async (position) => {
        calls++;
        expect(position.board).toEqual(createInitialBoard());
        if (calls === 1) throw new Error("Simulated request failure");
        return { move: 19, elapsed: 10 };
      },
      () => {},
    );
    match.start("human-jev", WHITE);
    await settleResponse();
    expect(match.state.paused).toBe(true);
    expect(match.state.error).toContain("Resume");
    expect(match.state.moveCount).toBe(0);
    match.togglePause();
    await settleResponse();
    expect(match.state.error).toBe("");
    expect(match.state.currentPlayer).toBe(WHITE);
    expect(match.state.jevRequests).toBe(1);
  });

  test("automatically passes blocked turns and stops when the game ends", async () => {
    jest.useFakeTimers();
    const chooseFirstLegalMove: RequestJevMove = async ({ board, player }) => ({
      move: getLegalMoves(board, player)[0],
      elapsed: 1,
    });
    const match = new MatchController(chooseFirstLegalMove, () => {});
    match.start("jev-jev", BLACK);
    for (let step = 0; step < 65; step++) {
      await settleResponse();
      jest.advanceTimersByTime(450);
    }
    expect(match.state.currentPlayer).toBe(null);
    expect(match.state.thinking).toBe(false);
    expect(match.state.moveCount).toBeLessThanOrEqual(60);
    expect(match.state.history.some((entry) => entry.type === "pass")).toBe(true);
    const requestsAtEnd = match.state.jevRequests;
    jest.advanceTimersByTime(5000);
    await settleResponse();
    expect(match.state.jevRequests).toBe(requestsAtEnd);
  });
});
