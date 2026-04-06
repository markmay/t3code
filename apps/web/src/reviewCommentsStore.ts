import { create } from "zustand";
import { randomUUID } from "~/lib/utils";

export type AnnotationSide = "deletions" | "additions";

/** Sentinel line number for file-level comments (not attached to a specific line). */
export const FILE_COMMENT_LINE_NUMBER = 0;

export interface ReviewComment {
  id: string;
  filePath: string;
  side: AnnotationSide;
  lineNumber: number;
  endLineNumber?: number | undefined;
  text: string;
  createdAt: string;
}

export interface DraftCommentTarget {
  filePath: string;
  side: AnnotationSide;
  lineNumber: number;
  endLineNumber?: number | undefined;
  prefillText?: string;
}

export interface ReviewCommentsState {
  comments: ReviewComment[];
  activeDraft: DraftCommentTarget | null;
  editingCommentId: string | null;

  openDraft: (target: Omit<DraftCommentTarget, "prefillText">) => void;
  closeDraft: () => void;
  submitComment: (text: string) => void;
  removeComment: (commentId: string) => void;
  startEditing: (commentId: string) => void;
  updateComment: (commentId: string, text: string) => void;
  clearAllComments: () => void;
}

export const useReviewCommentsStore = create<ReviewCommentsState>((set, get) => ({
  comments: [],
  activeDraft: null,
  editingCommentId: null,

  openDraft: (target) => {
    const { activeDraft } = get();
    if (
      activeDraft &&
      activeDraft.filePath === target.filePath &&
      activeDraft.side === target.side &&
      activeDraft.lineNumber === target.lineNumber
    ) {
      set({ activeDraft: null, editingCommentId: null });
      return;
    }
    const endLineNumber =
      target.endLineNumber != null && target.endLineNumber !== target.lineNumber
        ? target.endLineNumber
        : undefined;
    set({
      activeDraft: {
        filePath: target.filePath,
        side: target.side,
        lineNumber: target.lineNumber,
        endLineNumber,
      },
      editingCommentId: null,
    });
  },

  closeDraft: () => {
    set({ activeDraft: null, editingCommentId: null });
  },

  submitComment: (text) => {
    const { activeDraft } = get();
    const trimmed = text.trim();
    if (!activeDraft || trimmed.length === 0) return;

    const comment: ReviewComment = {
      id: randomUUID(),
      filePath: activeDraft.filePath,
      side: activeDraft.side,
      lineNumber: activeDraft.lineNumber,
      endLineNumber: activeDraft.endLineNumber,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      comments: [...state.comments, comment],
      activeDraft: null,
      editingCommentId: null,
    }));
  },

  removeComment: (commentId) => {
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== commentId),
    }));
  },

  startEditing: (commentId) => {
    const comment = get().comments.find((c) => c.id === commentId);
    if (!comment) return;

    set({
      editingCommentId: commentId,
      activeDraft: {
        filePath: comment.filePath,
        side: comment.side,
        lineNumber: comment.lineNumber,
        endLineNumber: comment.endLineNumber,
        prefillText: comment.text,
      },
    });
  },

  updateComment: (commentId, text) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    set((state) => ({
      comments: state.comments.map((c) => (c.id === commentId ? { ...c, text: trimmed } : c)),
      activeDraft: null,
      editingCommentId: null,
    }));
  },

  clearAllComments: () => {
    set({ comments: [], activeDraft: null, editingCommentId: null });
  },
}));
