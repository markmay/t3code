import { Badge } from "~/components/ui/badge";
import { useReviewCommentsStore } from "~/reviewCommentsStore";

export function DiffReviewCommentBadge() {
  const count = useReviewCommentsStore((s) => s.comments.length);

  if (count === 0) return null;

  return (
    <Badge variant="outline" size="sm">
      {count} {count === 1 ? "comment" : "comments"}
    </Badge>
  );
}
