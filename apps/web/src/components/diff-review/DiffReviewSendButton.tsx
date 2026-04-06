import { SendIcon } from "lucide-react";
import { useCallback, useState } from "react";
import type { ThreadId } from "@t3tools/contracts";
import { Button } from "~/components/ui/button";
import { useReviewCommentsStore } from "~/reviewCommentsStore";
import { formatReviewMessage } from "~/lib/formatReviewMessage";
import { readNativeApi } from "~/nativeApi";
import { newCommandId, newMessageId } from "~/lib/utils";
import { useStore } from "~/store";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE } from "~/types";

interface DiffReviewSendButtonProps {
  threadId: ThreadId | null;
  cwd: string | undefined;
}

export function DiffReviewSendButton({ threadId, cwd }: DiffReviewSendButtonProps) {
  const commentCount = useReviewCommentsStore((s) => s.comments.length);
  const [isSending, setIsSending] = useState(false);

  const activeThread = useStore((store) =>
    threadId ? store.threads.find((t) => t.id === threadId) : undefined,
  );

  const runtimeMode = activeThread?.runtimeMode ?? DEFAULT_RUNTIME_MODE;
  const interactionMode = activeThread?.interactionMode ?? DEFAULT_INTERACTION_MODE;

  const handleSend = useCallback(async () => {
    const api = readNativeApi();
    if (!api || !threadId) return;

    const { comments, clearAllComments } = useReviewCommentsStore.getState();
    if (comments.length === 0) return;

    const messageText = formatReviewMessage(comments, cwd);
    if (!messageText) return;

    setIsSending(true);
    try {
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: newCommandId(),
        threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: messageText,
          attachments: [],
        },
        runtimeMode,
        interactionMode,
        createdAt: new Date().toISOString(),
      });
      clearAllComments();
      window.requestAnimationFrame(() => {
        const composerEditor = document.querySelector<HTMLElement>('[contenteditable="true"]');
        composerEditor?.focus();
      });
    } catch (error) {
      console.error("Failed to send review comments to agent.", error);
    } finally {
      setIsSending(false);
    }
  }, [threadId, cwd, runtimeMode, interactionMode]);

  if (commentCount === 0) return null;

  return (
    <Button
      size="xs"
      variant="default"
      onClick={handleSend}
      disabled={!threadId || isSending}
    >
      <SendIcon className="size-3" />
      {isSending ? "Sending..." : "Send to agent"}
    </Button>
  );
}
