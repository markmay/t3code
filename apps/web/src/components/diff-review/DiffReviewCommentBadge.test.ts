import { beforeEach, describe, expect, it } from "vitest";
import { useReviewCommentsStore } from "~/reviewCommentsStore";

function getState() {
  return useReviewCommentsStore.getState();
}

/**
 * Tests for the DiffReviewCommentBadge logic.
 * Since the component uses `useReviewCommentsStore(s => s.comments.length)`,
 * we verify the store state that drives the badge rendering.
 */
describe("DiffReviewCommentBadge — store integration", () => {
  beforeEach(() => {
    getState().clearAllComments();
  });

  it("has zero comments initially", () => {
    expect(getState().comments.length).toBe(0);
  });

  it("counts 1 comment after submitting one", () => {
    getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("first");

    expect(getState().comments.length).toBe(1);
  });

  it("counts multiple comments correctly", () => {
    getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("first");
    getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 2 });
    getState().submitComment("second");
    getState().openDraft({ filePath: "c.ts", side: "deletions", lineNumber: 3 });
    getState().submitComment("third");

    expect(getState().comments.length).toBe(3);
  });

  it("decrements count after removing a comment", () => {
    getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("first");
    getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 2 });
    getState().submitComment("second");

    getState().removeComment(getState().comments[0]!.id);

    expect(getState().comments.length).toBe(1);
  });

  it("resets to zero after clearAllComments", () => {
    getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("first");

    getState().clearAllComments();

    expect(getState().comments.length).toBe(0);
  });
});
