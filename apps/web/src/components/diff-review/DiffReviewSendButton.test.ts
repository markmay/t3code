import { beforeEach, describe, expect, it } from "vitest";
import { useReviewCommentsStore } from "~/reviewCommentsStore";
import { formatReviewMessage } from "~/lib/formatReviewMessage";

function getState() {
  return useReviewCommentsStore.getState();
}

/**
 * Tests for the DiffReviewSendButton logic.
 * We test the message generation and store cleanup that the button orchestrates,
 * without testing the React component or WebSocket dispatch directly.
 */
describe("DiffReviewSendButton — message generation and store cleanup", () => {
  beforeEach(() => {
    getState().clearAllComments();
  });

  it("generates a formatted message from all comments", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 42 });
    getState().submitComment("fix this bug");
    getState().openDraft({ filePath: "src/utils.ts", side: "deletions", lineNumber: 10 });
    getState().submitComment("why was this removed?");

    const message = formatReviewMessage(getState().comments, "/Users/dev/project");

    expect(message).toContain("Please address the following code review comments.");
    expect(message).toContain("/Users/dev/project/src/app.ts L42: fix this bug");
    expect(message).toContain("/Users/dev/project/src/utils.ts L10: why was this removed?");
  });

  it("generates message without cwd when cwd is undefined", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5 });
    getState().submitComment("check this");

    const message = formatReviewMessage(getState().comments);

    expect(message).toContain("src/app.ts L5: check this");
    expect(message).not.toContain("undefined");
  });

  it("clearAllComments resets state after send", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("comment");
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 2 });

    // Simulate what the send button does after dispatch succeeds
    getState().clearAllComments();

    expect(getState().comments).toHaveLength(0);
    expect(getState().activeDraft).toBeNull();
    expect(getState().editingCommentId).toBeNull();
  });

  it("returns empty string when no comments exist", () => {
    const message = formatReviewMessage(getState().comments);
    expect(message).toBe("");
  });
});
