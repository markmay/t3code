import { beforeEach, describe, expect, it } from "vitest";
import { useReviewCommentsStore, FILE_COMMENT_LINE_NUMBER } from "~/reviewCommentsStore";
import { buildAnnotationsForFile } from "./useFileDiffAnnotations";
import { formatReviewMessage } from "~/lib/formatReviewMessage";

function getState() {
  return useReviewCommentsStore.getState();
}

/**
 * Integration test that simulates the full "click gutter → add comment → send to agent" flow.
 *
 * Since the gutter utility click is handled by the @pierre/diffs InteractionManager
 * (via onGutterUtilityClick in options), we simulate what happens when that callback fires:
 * it calls store.openDraft() with the line info from the SelectedLineRange.
 *
 * This test exercises the same code path the real UI uses.
 */
describe("DiffReview end-to-end flow", () => {
  beforeEach(() => {
    getState().clearAllComments();
  });

  it("simulates clicking gutter utility, adding a comment, and generating the agent message", () => {
    const filePath = "src/components/App.tsx";

    // Step 1: Simulate onGutterUtilityClick firing (InteractionManager calls this)
    // The SelectedLineRange has { start, end, side, endSide }
    const gutterClickRange = { start: 42, end: 42, side: "additions" as const };
    getState().openDraft({
      filePath,
      side: gutterClickRange.side ?? "additions",
      lineNumber: gutterClickRange.start,
    });

    // Step 2: Verify a draft annotation appears for this file
    const annotationsAfterDraft = buildAnnotationsForFile(
      filePath,
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(annotationsAfterDraft).toHaveLength(1);
    expect(annotationsAfterDraft[0]!.metadata.hasDraft).toBe(true);
    expect(annotationsAfterDraft[0]!.metadata.comments).toHaveLength(0);
    expect(annotationsAfterDraft[0]!.lineNumber).toBe(42);
    expect(annotationsAfterDraft[0]!.side).toBe("additions");

    // Step 3: Submit the comment (simulates typing + clicking "Comment" button)
    getState().submitComment("Is the eval necessary here?");

    // Step 4: Verify the comment is stored
    expect(getState().comments).toHaveLength(1);
    expect(getState().comments[0]!.text).toBe("Is the eval necessary here?");
    expect(getState().comments[0]!.filePath).toBe(filePath);
    expect(getState().comments[0]!.lineNumber).toBe(42);

    // Step 5: Verify the annotation now shows the comment (not the draft)
    const annotationsAfterSubmit = buildAnnotationsForFile(
      filePath,
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(annotationsAfterSubmit).toHaveLength(1);
    expect(annotationsAfterSubmit[0]!.metadata.hasDraft).toBe(false);
    expect(annotationsAfterSubmit[0]!.metadata.comments).toHaveLength(1);
    expect(annotationsAfterSubmit[0]!.metadata.comments[0]!.text).toBe("Is the eval necessary here?");

    // Step 6: Verify the formatted message matches expected output
    const message = formatReviewMessage(getState().comments, "/Users/dev/project");
    expect(message).toContain("Please address the following code review comments.");
    expect(message).toContain("/Users/dev/project/src/components/App.tsx L42: Is the eval necessary here?");

    // Step 7: Simulate "Send to agent" click → clearAllComments
    getState().clearAllComments();
    expect(getState().comments).toHaveLength(0);

    // Step 8: Verify annotations are empty after send
    const annotationsAfterClear = buildAnnotationsForFile(
      filePath,
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(annotationsAfterClear).toHaveLength(0);
  });

  it("handles multi-line gutter selection (range with start !== end)", () => {
    const filePath = "src/utils.ts";

    // Simulate gutter click-drag selecting lines 10-15
    getState().openDraft({
      filePath,
      side: "additions",
      lineNumber: 10,
      endLineNumber: 15,
    });

    getState().submitComment("This whole block should be refactored");

    expect(getState().comments).toHaveLength(1);
    expect(getState().comments[0]!.lineNumber).toBe(10);
    expect(getState().comments[0]!.endLineNumber).toBe(15);

    // Verify the formatted message shows the range
    const message = formatReviewMessage(getState().comments, "/project");
    expect(message).toContain("/project/src/utils.ts L10-L15: This whole block should be refactored");
  });

  it("single-line selection does not set endLineNumber", () => {
    getState().openDraft({
      filePath: "src/app.ts",
      side: "additions",
      lineNumber: 42,
      endLineNumber: 42,
    });
    getState().submitComment("single line");

    expect(getState().comments[0]!.endLineNumber).toBeUndefined();

    const message = formatReviewMessage(getState().comments);
    expect(message).toContain("src/app.ts L42: single line");
    expect(message).not.toContain("L42-L42");
  });

  it("handles multiple comments across different files", () => {
    // Add comment on file A
    getState().openDraft({ filePath: "src/a.ts", side: "additions", lineNumber: 5 });
    getState().submitComment("Fix naming");

    // Add comment on file B
    getState().openDraft({ filePath: "src/b.ts", side: "deletions", lineNumber: 20 });
    getState().submitComment("Why was this removed?");

    // Verify annotations are scoped per file
    const annotationsA = buildAnnotationsForFile(
      "src/a.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    const annotationsB = buildAnnotationsForFile(
      "src/b.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(annotationsA).toHaveLength(1);
    expect(annotationsA[0]!.metadata.comments[0]!.text).toBe("Fix naming");
    expect(annotationsB).toHaveLength(1);
    expect(annotationsB[0]!.metadata.comments[0]!.text).toBe("Why was this removed?");

    // Verify the formatted message includes both
    const message = formatReviewMessage(getState().comments);
    expect(message).toContain("src/a.ts L5: Fix naming");
    expect(message).toContain("src/b.ts L20: Why was this removed?");
  });

  it("escape key cancels the draft without propagating (does not close diff panel)", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    expect(getState().activeDraft).not.toBeNull();

    // Simulate what DiffReviewCommentInput does on Escape:
    // It calls closeDraft() and event.stopPropagation().
    // We verify the store-level behavior here (closeDraft cancels the draft).
    getState().closeDraft();

    expect(getState().activeDraft).toBeNull();
    expect(getState().comments).toHaveLength(0);
  });

  it("escape key cancels editing without losing the original comment", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("original text");
    const commentId = getState().comments[0]!.id;

    getState().startEditing(commentId);
    expect(getState().editingCommentId).toBe(commentId);

    // Simulate Escape during edit — closeDraft cancels editing but keeps the comment
    getState().closeDraft();

    expect(getState().editingCommentId).toBeNull();
    expect(getState().activeDraft).toBeNull();
    expect(getState().comments).toHaveLength(1);
    expect(getState().comments[0]!.text).toBe("original text");
  });

  it("clears all comments after send (simulating focus return to agent)", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5 });
    getState().submitComment("review comment");

    // Simulate what DiffReviewSendButton does:
    // 1. Format message
    const message = formatReviewMessage(getState().comments);
    expect(message.length).toBeGreaterThan(0);

    // 2. Clear all comments (after successful dispatch)
    getState().clearAllComments();
    expect(getState().comments).toHaveLength(0);
    expect(getState().activeDraft).toBeNull();

    // Note: The actual focus return to the composer is a DOM operation
    // tested via the event.stopPropagation() in the component.
  });

  it("supports file-level comments (no specific line)", () => {
    const filePath = "src/app.ts";

    // Open a file-level draft (lineNumber = FILE_COMMENT_LINE_NUMBER sentinel)
    getState().openDraft({
      filePath,
      side: "additions",
      lineNumber: FILE_COMMENT_LINE_NUMBER,
    });
    getState().submitComment("This file needs better error handling");

    expect(getState().comments).toHaveLength(1);
    expect(getState().comments[0]!.lineNumber).toBe(FILE_COMMENT_LINE_NUMBER);
    expect(getState().comments[0]!.text).toBe("This file needs better error handling");

    // Verify the formatted message shows file-level format (no line number)
    const message = formatReviewMessage(getState().comments, "/project");
    expect(message).toContain("/project/src/app.ts: This file needs better error handling");
    // Should NOT contain "L0:" for file-level comments
    expect(message).not.toContain("L0:");
  });

  it("file-level and line-level comments coexist on the same file", () => {
    const filePath = "src/app.ts";

    // Add file-level comment
    getState().openDraft({ filePath, side: "additions", lineNumber: FILE_COMMENT_LINE_NUMBER });
    getState().submitComment("File needs refactoring");

    // Add line-level comment
    getState().openDraft({ filePath, side: "additions", lineNumber: 42 });
    getState().submitComment("Fix this line");

    expect(getState().comments).toHaveLength(2);

    const message = formatReviewMessage(getState().comments, "/project");
    expect(message).toContain("/project/src/app.ts: File needs refactoring");
    expect(message).toContain("/project/src/app.ts L42: Fix this line");
  });

  it("handles edit flow: submit → edit → update", () => {
    const filePath = "src/app.ts";

    getState().openDraft({ filePath, side: "additions", lineNumber: 10 });
    getState().submitComment("Original comment");
    const commentId = getState().comments[0]!.id;

    // Start editing
    getState().startEditing(commentId);

    // Verify annotation shows draft mode for editing
    const annotationsDuringEdit = buildAnnotationsForFile(
      filePath,
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(annotationsDuringEdit).toHaveLength(1);
    expect(annotationsDuringEdit[0]!.metadata.hasDraft).toBe(true);
    expect(annotationsDuringEdit[0]!.metadata.editingCommentId).toBe(commentId);

    // Update the comment
    getState().updateComment(commentId, "Updated comment");
    expect(getState().comments[0]!.text).toBe("Updated comment");

    // Verify annotation is back to normal
    const annotationsAfterUpdate = buildAnnotationsForFile(
      filePath,
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(annotationsAfterUpdate).toHaveLength(1);
    expect(annotationsAfterUpdate[0]!.metadata.hasDraft).toBe(false);
    expect(annotationsAfterUpdate[0]!.metadata.editingCommentId).toBeNull();
  });
});
