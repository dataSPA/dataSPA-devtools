import { COPY_TO_CLIPBOARD } from "~/utils/constants";

type ClipboardResponse = {
  ok: boolean;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function copyText(text: string): Promise<ClipboardResponse> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }

    const textarea = document.getElementById(
      "clipboard-textarea",
    ) as HTMLTextAreaElement | null;

    if (!textarea) {
      return { ok: false, error: "Offscreen clipboard textarea is missing" };
    }

    textarea.value = text;
    textarea.select();

    const copied = document.execCommand("copy");
    if (!copied) {
      return {
        ok: false,
        error: "document.execCommand('copy') returned false",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Clipboard write failed",
    };
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isRecord(message)) return;
  if (message.target !== "offscreen") return;
  if (message.action !== COPY_TO_CLIPBOARD) return;
  if (typeof message.text !== "string") {
    return Promise.resolve({
      ok: false,
      error: "Invalid clipboard payload",
    } satisfies ClipboardResponse);
  }

  return copyText(message.text);
});
