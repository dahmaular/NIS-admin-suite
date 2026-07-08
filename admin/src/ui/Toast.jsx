import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckIcon, AlertIcon, SparkleIcon } from "./icons";

const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, kind = "ok") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind, leaving: false }]);
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    }, 3200);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3550);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.leaving ? " leaving" : ""}`}>
            <span className="t-icon">
              {t.kind === "ok" && <CheckIcon size={16} />}
              {t.kind === "err" && <AlertIcon size={16} />}
              {t.kind === "info" && <SparkleIcon size={16} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
