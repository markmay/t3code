import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
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
  endLineNumber?: number | undefined;
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
  const fileComments = comments.filter((c) => c.filePath === filePath);

  const groupMap = new Map<
    string,
    { side: AnnotationSide; lineNumber: number; endLineNumber?: number | undefined; comments: ReviewComment[] }
  >();

  for (const comment of fileComments) {
    const key = comment.endLineNumber != null
      ? `${comment.side}:${comment.lineNumber}:${comment.endLineNumber}`
      : `${comment.side}:${comment.lineNumber}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.comments.push(comment);
    } else {
      groupMap.set(key, { side: comment.side, lineNumber: comment.lineNumber, endLineNumber: comment.endLineNumber, comments: [comment] });
    }
  }

  const draftTargetsThisFile = activeDraft?.filePath === filePath;
  const draftKey = draftTargetsThisFile
    ? (activeDraft.endLineNumber != null
        ? `${activeDraft.side}:${activeDraft.lineNumber}:${activeDraft.endLineNumber}`
        : `${activeDraft.side}:${activeDraft.lineNumber}`)
    : null;

  // Ensure the draft line gets an annotation slot even without prior comments
  if (draftTargetsThisFile && draftKey && !groupMap.has(draftKey)) {
    groupMap.set(draftKey, {
      side: activeDraft.side,
      lineNumber: activeDraft.lineNumber,
      endLineNumber: activeDraft.endLineNumber,
      comments: [],
    });
  }

  const annotations: DiffLineAnnotation[] = [];
  for (const [key, group] of groupMap) {
    const hasDraft = key === draftKey;
    annotations.push({
      side: group.side,
      lineNumber: group.lineNumber,
      endLineNumber: group.endLineNumber,
      metadata: {
        comments: group.comments,
        hasDraft,
        editingCommentId: hasDraft ? editingCommentId : null,
      },
    });
  }

  return annotations;
}

interface SelectedLineRange {
  start: number;
  side?: "deletions" | "additions" | undefined;
  end: number;
  endSide?: "deletions" | "additions" | undefined;
}

const CONTENTS_STYLE = { display: "contents" } as const;
const FILE_REVIEW_BLOCK_STYLE = {
  flexBasis: "100%",
  borderTop: "1px solid var(--border)",
  padding: "0.5rem 0",
} as const;

/** Renders comment bubbles + optional draft input for a given annotation metadata. */
function renderCommentElements(
  metadata: ReviewAnnotationMetadata,
  keyPrefix: string,
): ReactNode[] {
  const elements: ReactNode[] = [];

  for (const comment of metadata.comments) {
    if (comment.id === metadata.editingCommentId) continue;
    elements.push(createElement(DiffReviewCommentBubble, { key: comment.id, comment }));
  }

  if (metadata.hasDraft) {
    elements.push(
      createElement(DiffReviewCommentInput, {
        key: `${keyPrefix}-draft`,
        prefillText: metadata.editingCommentId
          ? metadata.comments.find((c) => c.id === metadata.editingCommentId)?.text
          : undefined,
        editingCommentId: metadata.editingCommentId,
      }),
    );
  }

  return elements;
}

/**
 * Hook that builds `lineAnnotations`, `renderAnnotation`, `onGutterUtilityClick`,
 * and `renderHeaderMetadata` for a single FileDiff component.
 */
export function useFileDiffAnnotations(filePath: string, threadId?: string | null) {
  // File-scoped selectors: only re-render when this file's data changes
  const fileComments = useReviewCommentsStore(
    useShallow((s) =>
      s.comments.filter(
        (c) => c.filePath === filePath && (!c.threadId || !threadId || c.threadId === threadId),
      ),
    ),
  );
  const activeDraft = useReviewCommentsStore(
    (s) => (s.activeDraft?.filePath === filePath ? s.activeDraft : null),
  );
  const editingCommentId = useReviewCommentsStore((s) =>
    s.activeDraft?.filePath === filePath ? s.editingCommentId : null,
  );
  const openDraft = useReviewCommentsStore((s) => s.openDraft);

  const allAnnotations = useMemo(
    () => buildAnnotationsForFile(filePath, fileComments, activeDraft, editingCommentId),
    [filePath, fileComments, activeDraft, editingCommentId],
  );

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
      const elements = renderCommentElements(annotation.metadata, "line");
      if (elements.length === 0) return null;
      return createElement("div", { className: "flex flex-col gap-1 px-2" }, ...elements);
    },
    [],
  );

  const hasFileReviewContent = fileAnnotation !== null;

  /**
   * Renders the file-comment button in the header, plus file-level comments/draft
   * as a full-width block below the filename row. Uses display:contents wrappers
   * so the inner children participate directly in the [data-diffs-header] flex
   * layout, allowing the review block (flex-basis:100%) to wrap to a new row.
   */
  const renderHeaderMetadata = useCallback((): ReactNode => {
    const elements: ReactNode[] = [];

    elements.push(createElement(DiffReviewFileCommentButton, { key: "file-comment-btn", filePath }));

    if (fileAnnotation) {
      const commentElements = renderCommentElements(fileAnnotation.metadata, "file");

      if (commentElements.length > 0) {
        elements.push(
          createElement(
            "div",
            { key: "file-review-content", style: FILE_REVIEW_BLOCK_STYLE, className: "flex flex-col gap-1" },
            ...commentElements,
          ),
        );
      }
    }

    return createElement("span", { style: CONTENTS_STYLE }, ...elements);
  }, [filePath, fileAnnotation]);

  const onGutterUtilityClick = useCallback(
    (range: SelectedLineRange) => {
      openDraft({
        threadId: threadId ?? undefined,
        filePath,
        side: range.side ?? "additions",
        lineNumber: range.start,
        endLineNumber: range.end !== range.start ? range.end : undefined,
      });
    },
    [filePath, threadId, openDraft],
  );

  return {
    lineAnnotations,
    renderAnnotation,
    renderHeaderMetadata,
    hasFileReviewContent,
    onGutterUtilityClick,
  };
}
