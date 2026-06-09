/**
 * ThemeContext.tsx
 *
 * Context สำหรับจัดการธีม light/dark mode ของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลดธีมจาก localStorage หรือ system preference
 * - sync class dark เข้ากับ document root
 * - บันทึกธีมล่าสุดลง localStorage
 * - เปิด toggleTheme และ setTheme ให้ component อื่นเรียกใช้
 */

import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // ถ้ามีค่าที่ผู้ใช้เคยเลือกไว้ ให้ใช้ค่านั้นก่อน system preference
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) return savedTheme;

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;

    // Tailwind dark mode ใช้ class ".dark" ที่ root element
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
