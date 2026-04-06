import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import {
  useReviewCommentsStore,
  FILE_COMMENT_LINE_NUMBER,
  type AnnotationSide,
  type DraftCommentTarget,
  type ReviewComment,
} from "~/reviewCommentsStore";
import { DiffReviewCommentInput } from "./DiffReviewCommentInput";
import { DiffReviewCommentBubble } from "./DiffReviewCommentBubble";
import { DiffReviewFileCommentButton } from "./DiffReviewFileCommentButton";
import { createElement } from "react";

export interface ReviewAnnotationMetadata {
  comments: ReviewComment[];
  hasDraft: boolean;
  editingCommentId: string | null;
}

interface DiffLineAnnotation {
  side: AnnotationSide;
  lineNumber: number;
  metadata: ReviewAnnotationMetadata;
}

/**
 * Pure function that builds the annotation array for a single file.
 * Extracted from the hook so it can be tested without React rendering.
 */
export function buildAnnotationsForFile(
  filePath: string,
  comments: ReviewComment[],
  activeDraft: DraftCommentTarget | null,
  editingCommentId: string | null,
): DiffLineAnnotation[] {
  // Collect all comments for this file
  const fileComments = comments.filter((c) => c.filePath === filePath);

  // Group by (side, lineNumber)
  const groupMap = new Map<
    string,
    { side: AnnotationSide; lineNumber: number; comments: ReviewComment[] }
  >();

  for (const comment of fileComments) {
    const key = `${comment.side}:${comment.lineNumber}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { side: comment.side, lineNumber: comment.lineNumber, comments: [] };
      groupMap.set(key, group);
    }
    group.comments.push(comment);
  }

  // Check if the draft targets this file
  const draftTargetsThisFile = activeDraft?.filePath === filePath;
  const draftKey = draftTargetsThisFile
    ? `${activeDraft.side}:${activeDraft.lineNumber}`
    : null;

  // If draft targets a line with no existing comments, create a new group
  if (draftTargetsThisFile && draftKey && !groupMap.has(draftKey)) {
    groupMap.set(draftKey, {
      side: activeDraft.side,
      lineNumber: activeDraft.lineNumber,
      comments: [],
    });
  }

  // Build annotations array
  const annotations: DiffLineAnnotation[] = [];
  for (const [key, group] of groupMap) {
    const hasDraft = key === draftKey;
    annotations.push({
      side: group.side,
      lineNumber: group.lineNumber,
      metadata: {
        comments: group.comments,
        hasDraft,
        editingCommentId: hasDraft ? editingCommentId : null,
      },
    });
  }

  return annotations;
}

/**
 * SelectedLineRange as provided by @pierre/diffs onGutterUtilityClick callback.
 */
interface SelectedLineRange {
  start: number;
  side?: "deletions" | "additions" | undefined;
  end: number;
  endSide?: "deletions" | "additions" | undefined;
}

/**
 * Hook that builds `lineAnnotations`, `renderAnnotation`, `onGutterUtilityClick`,
 * and `renderHeaderMetadata` for a single FileDiff component.
 */
export function useFileDiffAnnotations(filePath: string) {
  const comments = useReviewCommentsStore((s) => s.comments);
  const activeDraft = useReviewCommentsStore((s) => s.activeDraft);
  const editingCommentId = useReviewCommentsStore((s) => s.editingCommentId);
  const openDraft = useReviewCommentsStore((s) => s.openDraft);

  const allAnnotations = useMemo(
    () => buildAnnotationsForFile(filePath, comments, activeDraft, editingCommentId),
    [filePath, comments, activeDraft, editingCommentId],
  );

  // Split: line-level annotations go to @pierre/diffs, file-level rendered in header
  const lineAnnotations = useMemo(
    () => allAnnotations.filter((a) => a.lineNumber !== FILE_COMMENT_LINE_NUMBER),
    [allAnnotations],
  );

  const fileAnnotation = useMemo(
    () => allAnnotations.find((a) => a.lineNumber === FILE_COMMENT_LINE_NUMBER) ?? null,
    [allAnnotations],
  );

  const renderAnnotation = useCallback(
    (annotation: {
      side: AnnotationSide;
      lineNumber: number;
      metadata: ReviewAnnotationMetadata;
    }): ReactNode => {
      const { metadata } = annotation;
      const elements: ReactNode[] = [];

      // Render existing comment bubbles (skip the one being edited)
      for (const comment of metadata.comments) {
        if (comment.id === metadata.editingCommentId) continue;
        elements.push(
          createElement(DiffReviewCommentBubble, { key: comment.id, comment }),
        );
      }

      // Render draft input if this line has an active draft
      if (metadata.hasDraft) {
        elements.push(
          createElement(DiffReviewCommentInput, {
            key: "draft-input",
            prefillText: metadata.editingCommentId
              ? metadata.comments.find((c) => c.id === metadata.editingCommentId)?.text
              : undefined,
            editingCommentId: metadata.editingCommentId,
          }),
        );
      }

      if (elements.length === 0) return null;

      return createElement("div", { className: "flex flex-col gap-1 px-2" }, ...elements);
    },
    [],
  );

  const hasFileReviewContent = fileAnnotation !== null;

  /**
   * Renders the ⊕ button inline in the header, plus (when active) the file-level
   * comment input/bubbles as a full-width block below the filename row.
   *
   * Uses `display: contents` on wrapper elements so the inner children participate
   * directly in the [data-diffs-header] flex layout. Combined with dynamic unsafeCSS
   * that sets flex-wrap on the header, the [data-file-review-content] div wraps to
   * a new full-width row below the filename.
   */
  const renderHeaderMetadata = useCallback((): ReactNode => {
    const elements: ReactNode[] = [];

    elements.push(createElement(DiffReviewFileCommentButton, { key: "file-comment-btn", filePath }));

    if (fileAnnotation) {
      const commentElements: ReactNode[] = [];

      for (const comment of fileAnnotation.metadata.comments) {
        if (comment.id === fileAnnotation.metadata.editingCommentId) continue;
        commentElements.push(
          createElement(DiffReviewCommentBubble, { key: comment.id, comment }),
        );
      }

      if (fileAnnotation.metadata.hasDraft) {
        commentElements.push(
          createElement(DiffReviewCommentInput, {
            key: "file-draft-input",
            prefillText: fileAnnotation.metadata.editingCommentId
              ? fileAnnotation.metadata.comments.find(
                  (c) => c.id === fileAnnotation.metadata.editingCommentId,
                )?.text
              : undefined,
            editingCommentId: fileAnnotation.metadata.editingCommentId,
          }),
        );
      }

      if (commentElements.length > 0) {
        elements.push(
          createElement(
            "div",
            {
              key: "file-review-content",
              style: { flexBasis: "100%", borderTop: "1px solid var(--border)", padding: "0.5rem 0" },
              className: "flex flex-col gap-1",
            },
            ...commentElements,
          ),
        );
      }
    }

    // display:contents makes this wrapper invisible for layout — its children
    // become direct flex items of the slotted div, which in turn uses
    // display:contents to become flex items of [data-diffs-header].
    return createElement("span", { style: { display: "contents" } }, ...elements);
  }, [filePath, fileAnnotation]);

  /**
   * Handler for @pierre/diffs' built-in gutter utility button click.
   */
  const onGutterUtilityClick = useCallback(
    (range: SelectedLineRange) => {
      openDraft({
        filePath,
        side: range.side ?? "additions",
        lineNumber: range.start,
        endLineNumber: range.end !== range.start ? range.end : undefined,
      });
    },
    [filePath, openDraft],
  );

  return {
    lineAnnotations,
    renderAnnotation,
    renderHeaderMetadata,
    hasFileReviewContent,
    onGutterUtilityClick,
  };
}
