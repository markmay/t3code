import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewCommentsStore } from "~/reviewCommentsStore";
import { cn } from "~/lib/utils";

interface DiffReviewCommentInputProps {
  /** Pre-filled text when editing an existing comment. */
  prefillText?: string | undefined;
  /** Comment ID being edited. When set, submit calls updateComment instead of submitComment. */
  editingCommentId?: string | null | undefined;
}

export function DiffReviewCommentInput({
  prefillText,
  editingCommentId,
}: DiffReviewCommentInputProps) {
  const [text, setText] = useState(prefillText ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitComment = useReviewCommentsStore((s) => s.submitComment);
  const updateComment = useReviewCommentsStore((s) => s.updateComment);
  const closeDraft = useReviewCommentsStore((s) => s.closeDraft);
  const cancelEditing = useReviewCommentsStore((s) => s.cancelEditing);

  const isEditing = Boolean(editingCommentId);
  const canSubmit = text.trim().length > 0;

  useEffect(() => {
    // Auto-focus textarea on mount
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    if (isEditing && editingCommentId) {
      updateComment(editingCommentId, text);
    } else {
      submitComment(text);
    }
  }, [canSubmit, isEditing, editingCommentId, text, submitComment, updateComment]);

  const handleCancel = useCallback(() => {
    if (isEditing) {
      cancelEditing();
    } else {
      closeDraft();
    }
  }, [isEditing, cancelEditing, closeDraft]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        handleSubmit();
      }
    },
    [handleCancel, handleSubmit],
  );

  return (
    <div className="my-1 rounded-md border border-border bg-card p-2 shadow-sm">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a review comment..."
        rows={3}
        className={cn(
          "w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
        )}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            canSubmit
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "cursor-not-allowed bg-primary/50 text-primary-foreground/50",
          )}
        >
          {isEditing ? "Update" : "Comment"}
        </button>
      </div>
    </div>
  );
}
