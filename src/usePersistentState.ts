import { useState, useEffect, useCallback } from 'react';

/**
 * usePersistentState<T>
 * Giong useState nhung tu dong doc/ghi vao localStorage.
 * - Khi mount: doc gia tri da luu tu localStorage, neu khong co thi dung initialValue.
 * - Moi khi state thay doi: ghi lai vao localStorage ngay lap tuc.
 * - An toan voi JSON.parse/stringify, bat loi gracefully.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // localStorage bi corrupt hoac khong kha dung -> dung gia tri mac dinh
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`[usePersistentState] Khong the ghi key "${key}" vao localStorage:`, e);
    }
  }, [key, state]);

  const clearPersisted = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setStateRaw(initialValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [state, setStateRaw, clearPersisted];
}
