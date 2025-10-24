browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "copy-to-clipboard") {
    const textarea = document.getElementById(
      "clipboard-textarea",
    ) as HTMLTextAreaElement;
    textarea.value = message.text;
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("❌ Clipboard write failed:", err);
    }
  }
});
