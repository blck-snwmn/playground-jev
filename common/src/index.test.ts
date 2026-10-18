import { expect, test } from "bun:test";
import { readJevMetadata, readChoiceDetails, isJevModel } from "./index";

test("keeps the requested and returned model separate with usage and recording time", () => {
  const result = readJevMetadata(
    { model: "jev-1.14.0", usage: { input_tokens: 321, output_tokens: 0 } },
    "jev-1.13.0",
  );
  expect(result).toMatchObject({
    requestedModel: "jev-1.13.0",
    model: "jev-1.14.0",
    usage: { input_tokens: 321, output_tokens: 0 },
  });
  expect(Number.isNaN(Date.parse(result.recordedAt))).toBe(false);
});

test("missing or malformed usage stays unknown instead of becoming zero", () => {
  for (const response of [
    null,
    {},
    { model: 7, usage: { input_tokens: -1, output_tokens: "20" } },
    { usage: { input_tokens: null, output_tokens: 0.5 } },
  ]) {
    expect(readJevMetadata(response, "jev-1.13.0")).toMatchObject({
      model: null,
      usage: { input_tokens: null, output_tokens: null },
    });
  }
});

test("only fixed model IDs can be selected", () => {
  expect(isJevModel("jev-1.13.0")).toBe(true);
  expect(isJevModel("jev-1.14.0")).toBe(true);
  for (const value of ["jev-latest", "jev-preview", "", null, {}, 1])
    expect(isJevModel(value)).toBe(false);
});

test("retains valid choice details without passing malformed values to the UI", () => {
  expect(readChoiceDetails({ confidence: 0.75, probabilities: { a: 0.8, b: 0.2 } })).toEqual({
    confidence: 0.75,
    probabilities: { a: 0.8, b: 0.2 },
  });
  expect(
    readChoiceDetails({ confidence: 5, probabilities: { a: NaN, b: -1, c: "0.2", d: 0 } }),
  ).toEqual({ confidence: null, probabilities: { d: 0 } });
});
