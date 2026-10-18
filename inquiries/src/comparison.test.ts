import { expect, test } from "bun:test";
import { conditions, pendingComparisons, resultKey, type Results } from "./comparison";
import { inquiries, localizeInquiry } from "./data";
import { buildJevRequest } from "./jev";
import type { TriageResult } from "./schema";

test("language changes only the inquiry text, never the service context or questions", () => {
  for (const inquiry of inquiries) {
    const english = buildJevRequest(inquiry, "jev-1.14.0", "en");
    const japanese = buildJevRequest(inquiry, "jev-1.14.0", "ja");
    const { inquiry: enText, ...enContext } = english.state;
    const { inquiry: jaText, ...jaContext } = japanese.state;
    expect(jaContext).toEqual(enContext);
    expect(japanese.questions).toEqual(english.questions);
    expect(jaText).toEqual({
      title: localizeInquiry(inquiry, "ja").title,
      body: localizeInquiry(inquiry, "ja").body,
    });
    expect(jaText.title).toMatch(/[ぁ-んァ-ヶ一-龠]/);
    expect(jaText.body).toMatch(/[ぁ-んァ-ヶ一-龠]/);
    expect(jaText).not.toEqual(enText);
    expect(enText).toEqual({ title: inquiry.title, body: inquiry.body });
  }
});

test("same-incident Japanese pairs preserve the facts after their different opening requests", () => {
  for (const [first, second] of [
    [inquiries[1], inquiries[9]],
    [inquiries[2], inquiries[3]],
  ]) {
    const a = localizeInquiry(first, "ja");
    const b = localizeInquiry(second, "ja");
    expect(a.title).toBe(b.title);
    const afterOpening = (body: string) => body.replace(/^.*?[。！]\s*/, "");
    expect(afterOpening(a.body)).toBe(afterOpening(b.body));
  }
});

test("completed results cannot suppress a different model, language, or inquiry", () => {
  const score = { score: 1, confidence: 1, probabilities: { "0": 0, "1": 1, "2": 0, "3": 0 } };
  const result: TriageResult = {
    urgency: score,
    pressure: score,
    department: {
      choice: "support",
      confidence: 1,
      probabilities: {
        support: 1,
        engineering: 0,
        billing: 0,
        sales: 0,
        product: 0,
        success: 0,
        unknown: 0,
      },
    },
    language: "en",
    requestedModel: "jev-1.13.0",
    model: "jev-1.13.0",
    elapsed: 10,
    usage: { input_tokens: 10, output_tokens: null },
    recordedAt: "2026-10-18T12:00:00Z",
  };
  const results: Results = { [resultKey(inquiries[0].id, conditions[0])]: result };
  expect(
    pendingComparisons(inquiries[0], results).map(({ model, language }) => [model, language]),
  ).toEqual([
    ["jev-1.13.0", "ja"],
    ["jev-1.14.0", "en"],
    ["jev-1.14.0", "ja"],
  ]);
  expect(pendingComparisons(inquiries[1], results)).toHaveLength(4);
  expect(
    new Set(
      inquiries.flatMap((inquiry) =>
        conditions.map((condition) => resultKey(inquiry.id, condition)),
      ),
    ).size,
  ).toBe(48);
});
