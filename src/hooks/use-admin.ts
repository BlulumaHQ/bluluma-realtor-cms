import { useEffect, useState } from "react";

const KEY = "admin_pw";

export function useAdminPassword() {
  const [pw, setPw] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") setPw(localStorage.getItem(KEY));
  }, []);
  return {
    password: pw,
    set: (v: string) => {
      localStorage.setItem(KEY, v);
      setPw(v);
    },
    clear: () => {
      localStorage.removeItem(KEY);
      setPw(null);
    },
  };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
