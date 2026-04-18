import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts.
 * - Cmd+K: Search
 * - G then D: Go to Dashboard
 * - G then C: Go to Contacts
 * - G then P: Go to Pipeline
 * - G then T: Go to Tasks
 * - G then A: Go to Automations
 * - G then S: Go to Settings
 * - N: New contact
 */
export function useKeyboardShortcuts(onOpenSearch: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      // Cmd+K / Ctrl+K: Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // "G" prefix for navigation
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimer);
        switch (e.key) {
          case "d": navigate("/"); break;
          case "c": navigate("/contacts"); break;
          case "p": navigate("/pipeline"); break;
          case "t": navigate("/tasks"); break;
          case "a": navigate("/automations"); break;
          case "s": navigate("/settings"); break;
        }
        return;
      }

      // "N" for new contact
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        navigate("/contacts?new=true");
      }

      // "?" for help / shortcuts reference
      if (e.key === "?") {
        // Could open a shortcuts modal
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimer);
    };
  }, [navigate, onOpenSearch]);
}
