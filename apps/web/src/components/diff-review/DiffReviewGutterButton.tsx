import { PlusIcon } from "lucide-react";
import { useCallback } from "react";
import { useReviewCommentsStore } from "~/reviewCommentsStore";

interface DiffReviewGutterButtonProps {
  filePath: string;
  getHoveredLine: () => { lineNumber: number; side: "deletions" | "additions" } | undefined;
}

export function DiffReviewGutterButton({ filePath, getHoveredLine }: DiffReviewGutterButtonProps) {
  const openDraft = useReviewCommentsStore((s) => s.openDraft);

  const handleClick = useCallback(() => {
    const hoveredLine = getHoveredLine();
    if (!hoveredLine) return;
    openDraft({
      filePath,
      side: hoveredLine.side,
      lineNumber: hoveredLine.lineNumber,
    });
  }, [filePath, getHoveredLine, openDraft]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      aria-label="Add review comment"
    >
      <PlusIcon className="size-3.5" />
    </button>
  );
}
