import { FILE_COMMENT_LINE_NUMBER, type ReviewComment } from "../reviewCommentsStore";

const MESSAGE_HEADER =
  "Please address the following code review comments.\nRun `git diff` to see the full context of any changes, especially for deleted lines.";

/**
 * Formats an array of review comments into a structured message for the coding agent.
 * Comments are grouped by file path and each comment includes the line reference.
 * File-level comments (lineNumber === FILE_COMMENT_LINE_NUMBER) omit the line number.
 */
export function formatReviewMessage(comments: ReviewComment[], cwd?: string): string {
  if (comments.length === 0) return "";

  const lines = comments.map((comment) => {
    const resolvedPath = cwd ? `${cwd}/${comment.filePath}` : comment.filePath;
    if (comment.lineNumber === FILE_COMMENT_LINE_NUMBER) {
      return `${resolvedPath}: ${comment.text}`;
    }
    const lineRef = comment.endLineNumber != null
      ? `L${comment.lineNumber}-L${comment.endLineNumber}`
      : `L${comment.lineNumber}`;
    return `${resolvedPath} ${lineRef}: ${comment.text}`;
  });

  return `${MESSAGE_HEADER}\n\n${lines.join("\n\n")}`;
}
