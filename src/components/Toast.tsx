"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 1500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--accent)] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg animate-slide-up pointer-events-none whitespace-nowrap">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
