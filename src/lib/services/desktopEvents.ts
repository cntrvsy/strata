/**
 * Utility service for handling desktop webview event behaviors:
 * 1. Suppressing default context menu on non-editable elements in production.
 * 2. Fallback keybindings for copy/paste on input and textarea elements in Tauri webviews.
 */
export function initDesktopEvents(): () => void {
  // Prevent context menu (right-click) in production builds except on editable text fields
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"]')))
    ) {
      return; // Allow native context menu on input fields for Copy/Paste/Cut
    }
    if (import.meta.env.PROD) {
      e.preventDefault();
    }
  };

  // Explicit Ctrl+C / Ctrl+V fallback handler for input fields
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (
      !activeEl ||
      (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'v' && !activeEl.readOnly && !activeEl.disabled) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const start = activeEl.selectionStart ?? activeEl.value.length;
          const end = activeEl.selectionEnd ?? activeEl.value.length;
          const val = activeEl.value;
          activeEl.value = val.substring(0, start) + text + val.substring(end);
          activeEl.selectionStart = activeEl.selectionEnd = start + text.length;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch {
        // Fallback to browser native paste
      }
    } else if (key === 'c') {
      const selection = activeEl.value.substring(
        activeEl.selectionStart ?? 0,
        activeEl.selectionEnd ?? 0
      );
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection);
        } catch {
          // Fallback to browser native copy
        }
      }
    }
  };

  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
