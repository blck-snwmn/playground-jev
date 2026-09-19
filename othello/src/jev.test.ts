import { rejects } from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { BLACK, createInitialBoard, type Position } from "./game";
import { buildJevRequest, chooseJevMove, JevHttpError } from "./jev";

const position: Position = { board: createInitialBoard(), player: BLACK };
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("Jev requests and responses", () => {
  test("sends the board as state and all legal moves with consequences as criteria", () => {
    const request = buildJevRequest(position, "test-model");
    expect(request.model).toBe("test-model");
    expect(request.state.you).toBe("black");
    expect(request.state.board).toEqual([
      "........",
      "........",
      "........",
      "...WB...",
      "...BW...",
      "........",
      "........",
      "........",
    ]);
    expect(request.questions.move.type).toBe("choice");
    expect(Object.keys(request.questions.move.criteria)).toEqual(["d3", "c4", "f5", "e6"]);
    expect(request.questions.move.criteria.d3).toEqual({
      flips: 1,
      opponentLegalMoves: ["c3", "e3", "c5"],
    });
  });

  test("converts the selected coordinate to a board index and returns decision details", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        model: "test-model",
        answers: {
          move: { choice: "d3", confidence: 0.8, probabilities: { d3: 0.9 } },
        },
      }),
    );
    const result = await chooseJevMove(position, "dummy-test-key", "test-model");
    expect(result.move).toBe(19);
    expect(result.confidence).toBe(0.8);
    expect(result.probabilities).toEqual({ d3: 0.9 });
    expect(result.model).toBe("test-model");
  });

  test("rejects illegal moves returned by the API", async () => {
    fetchSpy.mockResolvedValue(Response.json({ answers: { move: { choice: "a1" } } }));
    await rejects(chooseJevMove(position, "dummy-test-key", "test-model"), /illegal move/);
  });

  test("reports the API error status without exposing the response body", async () => {
    fetchSpy.mockResolvedValue(new Response("upstream details", { status: 429 }));
    await rejects(chooseJevMove(position, "dummy-test-key", "test-model"), JevHttpError);
  });
});
