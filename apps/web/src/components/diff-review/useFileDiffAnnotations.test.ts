import { beforeEach, describe, expect, it } from "vitest";
import { useReviewCommentsStore } from "~/reviewCommentsStore";
import { buildAnnotationsForFile } from "./useFileDiffAnnotations";

function getState() {
  return useReviewCommentsStore.getState();
}

describe("useFileDiffAnnotations — buildAnnotationsForFile", () => {
  beforeEach(() => {
    getState().clearAllComments();
  });

  it("returns empty array when no comments or draft exist for the file", () => {
    const result = buildAnnotationsForFile(
      "src/other.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    expect(result).toEqual([]);
  });

  it("returns an annotation for a submitted comment", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("first comment");

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.side).toBe("additions");
    expect(result[0]!.lineNumber).toBe(10);
    expect(result[0]!.metadata.comments).toHaveLength(1);
    expect(result[0]!.metadata.hasDraft).toBe(false);
    expect(result[0]!.metadata.editingCommentId).toBeNull();
  });

  it("returns an annotation for a draft on a line with no comments", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5 });

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(5);
    expect(result[0]!.metadata.comments).toHaveLength(0);
    expect(result[0]!.metadata.hasDraft).toBe(true);
  });

  it("merges draft into existing comment annotation on the same line", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("existing");
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.metadata.comments).toHaveLength(1);
    expect(result[0]!.metadata.hasDraft).toBe(true);
  });

  it("filters to only the requested file", () => {
    getState().openDraft({ filePath: "src/a.ts", side: "additions", lineNumber: 1 });
    getState().submitComment("a comment");
    getState().openDraft({ filePath: "src/b.ts", side: "additions", lineNumber: 2 });
    getState().submitComment("b comment");

    const resultA = buildAnnotationsForFile(
      "src/a.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    const resultB = buildAnnotationsForFile(
      "src/b.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(resultA).toHaveLength(1);
    expect(resultA[0]!.metadata.comments[0]!.text).toBe("a comment");
    expect(resultB).toHaveLength(1);
    expect(resultB[0]!.metadata.comments[0]!.text).toBe("b comment");
  });

  it("groups multiple comments on the same line into one annotation", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5 });
    getState().submitComment("first");
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5 });
    getState().submitComment("second");

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.metadata.comments).toHaveLength(2);
  });

  it("creates separate annotations for different sides on the same line number", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("addition comment");
    getState().openDraft({ filePath: "src/app.ts", side: "deletions", lineNumber: 10 });
    getState().submitComment("deletion comment");

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(2);
    const additionAnnotation = result.find((a) => a.side === "additions");
    const deletionAnnotation = result.find((a) => a.side === "deletions");
    expect(additionAnnotation!.metadata.comments[0]!.text).toBe("addition comment");
    expect(deletionAnnotation!.metadata.comments[0]!.text).toBe("deletion comment");
  });

  it("selects the correct line when a draft is opened on a specific line number", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 42 });

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(42);
    expect(result[0]!.side).toBe("additions");
    expect(result[0]!.metadata.hasDraft).toBe(true);
  });

  it("selects the deletions side when a draft targets a deleted line", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "deletions", lineNumber: 7 });

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(7);
    expect(result[0]!.side).toBe("deletions");
  });

  it("preserves the selected line from a comment even after the draft is closed", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 99 });
    getState().submitComment("pinned to line 99");
    // Draft is now closed after submit
    expect(getState().activeDraft).toBeNull();

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(99);
    expect(result[0]!.side).toBe("additions");
    expect(result[0]!.metadata.comments[0]!.text).toBe("pinned to line 99");
  });

  it("tracks line selection independently per file and side", () => {
    // Comment on additions line 10 in file A
    getState().openDraft({ filePath: "src/a.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("additions L10");
    // Comment on deletions line 10 in file A (same line number, different side)
    getState().openDraft({ filePath: "src/a.ts", side: "deletions", lineNumber: 10 });
    getState().submitComment("deletions L10");
    // Comment on additions line 20 in file B
    getState().openDraft({ filePath: "src/b.ts", side: "additions", lineNumber: 20 });
    getState().submitComment("additions L20");

    const resultA = buildAnnotationsForFile(
      "src/a.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );
    const resultB = buildAnnotationsForFile(
      "src/b.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    // File A: two annotations (additions:10 and deletions:10)
    expect(resultA).toHaveLength(2);
    expect(resultA.map((a) => `${a.side}:${a.lineNumber}`).sort()).toEqual([
      "additions:10",
      "deletions:10",
    ]);

    // File B: one annotation (additions:20)
    expect(resultB).toHaveLength(1);
    expect(resultB[0]!.lineNumber).toBe(20);
    expect(resultB[0]!.side).toBe("additions");
  });

  it("creates separate annotations for different ranges with the same start line", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("single line");
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10, endLineNumber: 15 });
    getState().submitComment("range comment");

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(2);
    const singleLine = result.find((a) => a.endLineNumber == null);
    const rangeAnnotation = result.find((a) => a.endLineNumber === 15);
    expect(singleLine!.metadata.comments[0]!.text).toBe("single line");
    expect(rangeAnnotation!.metadata.comments[0]!.text).toBe("range comment");
  });

  it("includes endLineNumber in annotations", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 5, endLineNumber: 8 });
    getState().submitComment("range");

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(5);
    expect(result[0]!.endLineNumber).toBe(8);
  });

  it("sets editingCommentId in annotation metadata when editing", () => {
    getState().openDraft({ filePath: "src/app.ts", side: "additions", lineNumber: 10 });
    getState().submitComment("editable");
    const commentId = getState().comments[0]!.id;
    getState().startEditing(commentId);

    const result = buildAnnotationsForFile(
      "src/app.ts",
      getState().comments,
      getState().activeDraft,
      getState().editingCommentId,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.metadata.editingCommentId).toBe(commentId);
    expect(result[0]!.metadata.hasDraft).toBe(true);
  });
});
