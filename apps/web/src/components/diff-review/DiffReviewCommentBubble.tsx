import { PencilIcon, Trash2Icon } from "lucide-react";
import { useCallback } from "react";
import { useReviewCommentsStore, type ReviewComment } from "~/reviewCommentsStore";

interface DiffReviewCommentBubbleProps {
  comment: ReviewComment;
}

export function DiffReviewCommentBubble({ comment }: DiffReviewCommentBubbleProps) {
  const startEditing = useReviewCommentsStore((s) => s.startEditing);
  const removeComment = useReviewCommentsStore((s) => s.removeComment);

  const handleEdit = useCallback(() => {
    startEditing(comment.id);
  }, [comment.id, startEditing]);

  const handleDelete = useCallback(() => {
    removeComment(comment.id);
  }, [comment.id, removeComment]);

  const rangeLabel =
    comment.endLineNumber != null
      ? `L${comment.lineNumber}\u2013L${comment.endLineNumber}`
      : null;

  return (
    <div className="my-1 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {rangeLabel && (
            <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
              {rangeLabel}
            </span>
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Edit comment"
          >
            <PencilIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete comment"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
