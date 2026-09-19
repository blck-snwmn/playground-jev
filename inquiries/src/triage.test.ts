import { describe, expect, spyOn, test } from "bun:test";
import { inquiries } from "./data";
import { answersSchema, buildJevRequest, classifyInquiry } from "./jev";
import { departmentSuggestion, scorePercent, urgencyLevels, type DepartmentAnswer } from "./triage";

function answer(
  confidence: number,
  choice: DepartmentAnswer["choice"] = "billing",
): DepartmentAnswer {
  return {
    choice,
    confidence,
    probabilities: {
      billing: 0.55,
      engineering: 0.35,
      support: 0.1,
      sales: 0,
      success: 0,
      product: 0,
      unknown: 0,
    },
  };
}

describe("department display policy", () => {
  test("threshold includes equality and changing it changes the display", () => {
    expect(departmentSuggestion(answer(0.8), 0.8)).toBe(
      "Recommended: Finance (Billing & Payments)",
    );
    expect(departmentSuggestion(answer(0.8), 0.85)).toBe(
      "Candidates: Finance (Billing & Payments), Engineering",
    );
  });
  test("low confidence and unknown always need review", () => {
    expect(departmentSuggestion(answer(0.29), 0.3)).toBe("Needs review");
    expect(departmentSuggestion(answer(0.99, "unknown"), 0.8)).toBe("Needs review");
    expect(departmentSuggestion(answer(0.3), 0.8)).toBe(
      "Candidates: Finance (Billing & Payments), Engineering",
    );
  });
});

test("fractional Score values are scaled to 0–100", () => {
  expect(scorePercent(0, urgencyLevels)).toBe(0);
  expect(scorePercent(1.5, urgencyLevels)).toBe(50);
  expect(scorePercent(3, urgencyLevels)).toBe(100);
});

test("state holds the inquiry and questions distinguish urgency from wording", () => {
  const request = buildJevRequest(inquiries[0]);
  expect(request.state.inquiry.body).toBe(inquiries[0].body);
  expect(request.questions.urgency.type).toBe("score");
  expect(request.questions.pressure.type).toBe("score");
  expect(request.questions.department.type).toBe("choice");
  expect(request.questions.department.criteria.unknown).toBeTruthy();
});

test("malformed upstream results cannot become displayed scores", () => {
  const score = {
    score: 1.5,
    confidence: 0.5,
    probabilities: { "0": 0, "1": 0.5, "2": 0.5, "3": 0 },
  };
  const valid = { urgency: score, pressure: score, department: answer(0.5) };
  expect(answersSchema.safeParse(valid).success).toBe(true);
  expect(answersSchema.safeParse({ ...valid, urgency: { ...score, score: 101 } }).success).toBe(
    false,
  );
  expect(
    answersSchema.safeParse({
      ...valid,
      department: { ...answer(0.5), choice: "invented" },
    }).success,
  ).toBe(false);
  expect(answersSchema.safeParse({ ...valid, pressure: { score: 1 } }).success).toBe(false);
});

test("Jev transport returns validated results and hides upstream error details", async () => {
  const score = {
    score: 1.5,
    confidence: 0.5,
    probabilities: { "0": 0, "1": 0.5, "2": 0.5, "3": 0 },
  };
  const answers = { urgency: score, pressure: score, department: answer(0.5) };
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ answers }));
  try {
    const result = await classifyInquiry(inquiries[0], "test-key");
    expect(result.department.choice).toBe("billing");
    expect(result.urgency.score).toBe(1.5);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.typesafe.ai/v1/systemone");
    const init = fetchMock.mock.calls[0]?.[1];
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
    expect(JSON.parse(init.body)).toEqual(buildJevRequest(inquiries[0]));

    fetchMock.mockResolvedValueOnce(new Response("upstream-private-detail", { status: 401 }));
    const failure = await classifyInquiry(inquiries[0], "test-key").catch(
      (error: unknown) => error,
    );
    expect(failure).toEqual(new Error("Jev request failed"));
  } finally {
    fetchMock.mockRestore();
  }
});
