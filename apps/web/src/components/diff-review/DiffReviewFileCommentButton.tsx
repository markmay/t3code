import { MessageSquarePlusIcon, MessageSquareXIcon } from "lucide-react";
import { useCallback } from "react";
import { useReviewCommentsStore, FILE_COMMENT_LINE_NUMBER } from "~/reviewCommentsStore";

interface DiffReviewFileCommentButtonProps {
  filePath: string;
}

/**
 * Button rendered in the file diff header that toggles a file-level comment draft.
 * Shows + when closed, - when the draft is open for this file.
 */
export function DiffReviewFileCommentButton({ filePath }: DiffReviewFileCommentButtonProps) {
  const openDraft = useReviewCommentsStore((s) => s.openDraft);
  const isOpen = useReviewCommentsStore(
    (s) =>
      s.activeDraft?.filePath === filePath &&
      s.activeDraft?.lineNumber === FILE_COMMENT_LINE_NUMBER,
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      openDraft({
        filePath,
        side: "additions",
        lineNumber: FILE_COMMENT_LINE_NUMBER,
      });
    },
    [filePath, openDraft],
  );

  const Icon = isOpen ? MessageSquareXIcon : MessageSquarePlusIcon;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label={isOpen ? "Close file comment" : "Add file comment"}
      title={isOpen ? "Close file comment" : "Add file comment"}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
