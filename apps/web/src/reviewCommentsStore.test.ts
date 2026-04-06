import { beforeEach, describe, expect, it } from "vitest";
import { useReviewCommentsStore } from "./reviewCommentsStore";

function getState() {
  return useReviewCommentsStore.getState();
}

describe("reviewCommentsStore", () => {
  beforeEach(() => {
    getState().clearAllComments();
  });

  describe("openDraft", () => {
    it("sets activeDraft with the given target", () => {
      getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });

      expect(getState().activeDraft).toEqual({
        filePath: "src/app.ts",
        side: "additions",
        lineNumber: 10,
      });
    });

    it("replaces any existing draft", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().openDraft({ filePath: "b.ts", side: "deletions", lineNumber: 5 });

      expect(getState().activeDraft).toEqual({
        filePath: "b.ts",
        side: "deletions",
        lineNumber: 5,
      });
    });

    it("clears editingCommentId when opening a new draft", () => {
      // Submit a comment first, then start editing it
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("first comment");
      const commentId = getState().comments[0]!.id;
      getState().startEditing(commentId);

      expect(getState().editingCommentId).toBe(commentId);

      // Opening a fresh draft should clear editingCommentId
      getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 2 });
      expect(getState().editingCommentId).toBeNull();
    });

    it("toggles off when called with the same target that is already open", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      expect(getState().activeDraft).not.toBeNull();

      // Same target again → close
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      expect(getState().activeDraft).toBeNull();
    });

    it("does not toggle off when target differs by lineNumber", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 20 });

      expect(getState().activeDraft).toEqual({
        filePath: "a.ts",
        side: "additions",
        lineNumber: 20,
      });
    });

    it("does not toggle off when target differs by side", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      getState().openDraft({ filePath: "a.ts", side: "deletions", lineNumber: 10 });

      expect(getState().activeDraft).toEqual({
        filePath: "a.ts",
        side: "deletions",
        lineNumber: 10,
      });
    });

    it("does not toggle off when target differs by filePath", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 10 });

      expect(getState().activeDraft).toEqual({
        filePath: "b.ts",
        side: "additions",
        lineNumber: 10,
      });
    });
  });

  describe("closeDraft", () => {
    it("clears activeDraft and editingCommentId", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().closeDraft();

      expect(getState().activeDraft).toBeNull();
      expect(getState().editingCommentId).toBeNull();
    });
  });

  describe("submitComment", () => {
    it("creates a comment from the active draft", () => {
      getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 42 });
      getState().submitComment("fix this bug");

      expect(getState().comments).toHaveLength(1);
      const comment = getState().comments[0]!;
      expect(comment.filePath).toBe("src/app.ts");
      expect(comment.side).toBe("additions");
      expect(comment.lineNumber).toBe(42);
      expect(comment.text).toBe("fix this bug");
      expect(comment.id).toBeTruthy();
      expect(comment.createdAt).toBeTruthy();
    });

    it("clears the draft after submitting", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("comment");

      expect(getState().activeDraft).toBeNull();
    });

    it("trims whitespace from comment text", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("  trimmed text  ");

      expect(getState().comments[0]!.text).toBe("trimmed text");
    });

    it("is a no-op when text is empty", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("");

      expect(getState().comments).toHaveLength(0);
      expect(getState().activeDraft).not.toBeNull();
    });

    it("is a no-op when text is only whitespace", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("   ");

      expect(getState().comments).toHaveLength(0);
    });

    it("is a no-op when there is no active draft", () => {
      getState().submitComment("orphan comment");

      expect(getState().comments).toHaveLength(0);
    });

    it("allows multiple comments on the same line", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 5 });
      getState().submitComment("first");
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 5 });
      getState().submitComment("second");

      expect(getState().comments).toHaveLength(2);
    });
  });

  describe("removeComment", () => {
    it("removes a comment by id", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("comment 1");
      getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 2 });
      getState().submitComment("comment 2");

      const idToRemove = getState().comments[0]!.id;
      getState().removeComment(idToRemove);

      expect(getState().comments).toHaveLength(1);
      expect(getState().comments[0]!.text).toBe("comment 2");
    });

    it("is a no-op for unknown id", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("comment");

      getState().removeComment("nonexistent-id");

      expect(getState().comments).toHaveLength(1);
    });
  });

  describe("startEditing", () => {
    it("sets editingCommentId and opens draft with prefilled text", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 10 });
      getState().submitComment("original text");
      const commentId = getState().comments[0]!.id;

      getState().startEditing(commentId);

      expect(getState().editingCommentId).toBe(commentId);
      expect(getState().activeDraft).toEqual({
        filePath: "a.ts",
        side: "additions",
        lineNumber: 10,
        prefillText: "original text",
      });
    });

    it("is a no-op for unknown comment id", () => {
      getState().startEditing("nonexistent");

      expect(getState().editingCommentId).toBeNull();
      expect(getState().activeDraft).toBeNull();
    });
  });

  describe("cancelEditing", () => {
    it("clears both activeDraft and editingCommentId", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("text");
      getState().startEditing(getState().comments[0]!.id);

      getState().cancelEditing();

      expect(getState().activeDraft).toBeNull();
      expect(getState().editingCommentId).toBeNull();
    });
  });

  describe("updateComment", () => {
    it("updates the text of an existing comment", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("original");
      const commentId = getState().comments[0]!.id;

      getState().startEditing(commentId);
      getState().updateComment(commentId, "updated text");

      expect(getState().comments[0]!.text).toBe("updated text");
      expect(getState().activeDraft).toBeNull();
      expect(getState().editingCommentId).toBeNull();
    });

    it("trims whitespace", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("original");
      const commentId = getState().comments[0]!.id;

      getState().updateComment(commentId, "  updated  ");

      expect(getState().comments[0]!.text).toBe("updated");
    });

    it("is a no-op when text is empty", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("original");
      const commentId = getState().comments[0]!.id;

      getState().updateComment(commentId, "");

      expect(getState().comments[0]!.text).toBe("original");
    });
  });

  describe("clearAllComments", () => {
    it("resets all state", () => {
      getState().openDraft({ filePath: "a.ts", side: "additions", lineNumber: 1 });
      getState().submitComment("comment 1");
      getState().openDraft({ filePath: "b.ts", side: "additions", lineNumber: 2 });

      getState().clearAllComments();

      expect(getState().comments).toHaveLength(0);
      expect(getState().activeDraft).toBeNull();
      expect(getState().editingCommentId).toBeNull();
    });
  });
});
