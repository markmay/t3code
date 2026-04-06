import { describe, expect, it } from "vitest";
import { formatReviewMessage } from "./formatReviewMessage";
import type { ReviewComment } from "../reviewCommentsStore";

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: crypto.randomUUID(),
    filePath: "src/app.ts",
    side: "additions",
    lineNumber: 42,
    text: "fix this bug",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("formatReviewMessage", () => {
  it("returns empty string for empty array", () => {
    expect(formatReviewMessage([])).toBe("");
  });

  it("formats a single comment", () => {
    const result = formatReviewMessage([makeComment({ text: "is this necessary?" })]);

    expect(result).toContain("Please address the following code review comments.");
    expect(result).toContain("src/app.ts L42: is this necessary?");
  });

  it("includes cwd prefix when provided", () => {
    const result = formatReviewMessage(
      [makeComment({ filePath: "src/app.ts", lineNumber: 10, text: "check this" })],
      "/Users/dev/project",
    );

    expect(result).toContain("/Users/dev/project/src/app.ts L10: check this");
  });

  it("omits cwd prefix when not provided", () => {
    const result = formatReviewMessage([
      makeComment({ filePath: "src/app.ts", lineNumber: 10, text: "check this" }),
    ]);

    expect(result).toContain("src/app.ts L10: check this");
    expect(result).not.toContain("undefined");
  });

  it("formats multiple comments from the same file", () => {
    const result = formatReviewMessage([
      makeComment({ filePath: "src/app.ts", lineNumber: 10, text: "first comment" }),
      makeComment({ filePath: "src/app.ts", lineNumber: 20, text: "second comment" }),
    ]);

    expect(result).toContain("src/app.ts L10: first comment");
    expect(result).toContain("src/app.ts L20: second comment");
  });

  it("formats comments from multiple files", () => {
    const result = formatReviewMessage([
      makeComment({ filePath: "src/app.ts", lineNumber: 5, text: "app comment" }),
      makeComment({ filePath: "src/utils.ts", lineNumber: 15, text: "utils comment" }),
    ]);

    expect(result).toContain("src/app.ts L5: app comment");
    expect(result).toContain("src/utils.ts L15: utils comment");
  });

  it("separates comments with double newlines", () => {
    const result = formatReviewMessage([
      makeComment({ filePath: "a.ts", lineNumber: 1, text: "first" }),
      makeComment({ filePath: "b.ts", lineNumber: 2, text: "second" }),
    ]);

    const commentLines = result.split("\n\n");
    // Header is the first block, then each comment is separated
    expect(commentLines.length).toBeGreaterThanOrEqual(3);
  });

  it("includes the git diff instruction in header", () => {
    const result = formatReviewMessage([makeComment()]);

    expect(result).toContain("Run `git diff` to see the full context of any changes");
  });

  it("includes (deleted) label for deletion-side comments", () => {
    const result = formatReviewMessage([
      makeComment({ side: "deletions", lineNumber: 5, text: "why was this removed?" }),
    ]);

    expect(result).toContain("src/app.ts L5 (deleted): why was this removed?");
  });

  it("omits side label for addition-side comments", () => {
    const result = formatReviewMessage([
      makeComment({ side: "additions", lineNumber: 5, text: "looks good" }),
    ]);

    expect(result).toContain("src/app.ts L5: looks good");
    expect(result).not.toContain("(deleted)");
  });

  it("includes (deleted) label with range references", () => {
    const result = formatReviewMessage([
      makeComment({ side: "deletions", lineNumber: 5, endLineNumber: 10, text: "this block" }),
    ]);

    expect(result).toContain("src/app.ts L5-L10 (deleted): this block");
  });

  it("formats range comments with line range reference", () => {
    const result = formatReviewMessage([
      makeComment({ lineNumber: 10, endLineNumber: 15, text: "refactor this" }),
    ]);

    expect(result).toContain("src/app.ts L10-L15: refactor this");
  });
});
