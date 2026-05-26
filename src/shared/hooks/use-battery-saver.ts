import { useCallback, useEffect, useState } from "react";

const KEY = "defcon-battery-saver";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

function applyClass(on: boolean) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("battery-saver", on);
}

export function useBatterySaver() {
  const [enabled, setEnabled] = useState<boolean>(() => read());

  useEffect(() => {
    applyClass(enabled);
    return () => applyClass(false);
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { enabled, toggle };
}
