import { useState } from "react";

export function useStoredKey(storageKey: string) {
  const [key, setKeyState] = useState(() => localStorage.getItem(storageKey) ?? "");

  const setKey = (value: string) => {
    setKeyState(value);
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  };

  return [key, setKey] as const;
}
