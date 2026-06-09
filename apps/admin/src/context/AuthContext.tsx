/**
 * AuthContext.tsx
 *
 * Context สำหรับจัดการ auth state และ token ของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บ JWT token ไว้ใน sessionStorage
 * - ฟื้น session จาก token เดิมเมื่อเปิดหน้า Admin
 * - รับ event 401 จาก API interceptor เพื่อ logout อัตโนมัติ
 * - ล้าง React Query cache เมื่อ login/logout เพื่อกันข้อมูลข้าม session
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import api from "../services/api";
import Logger from "../utils/logger";

interface User {
  id: string;
  email: string;
  role: "ADMIN";
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_STORAGE_KEY = "token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // อ่าน token ตั้งแต่ render แรก เพื่อลด route flicker ระหว่างตรวจ session
  const initialToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(initialToken);
  const [isLoading, setIsLoading] = useState(Boolean(initialToken));
  const queryClient = useQueryClient();

  const resetAuthState = useCallback(
    (clearCache: boolean): void => {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);

      // clear cache เมื่อเปลี่ยน session เพื่อไม่ให้ข้อมูล admin รอบเก่าค้างอยู่
      if (clearCache) {
        queryClient.clear();
      }

      setToken(null);
      setUser(null);
      setIsLoading(false);
    },
    [queryClient]
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      // API interceptor จะยิง event นี้เมื่อ backend ตอบ 401
      resetAuthState(true);
    };

    window.addEventListener("fallhelp:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("fallhelp:unauthorized", handleUnauthorized);
    };
  }, [resetAuthState]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        // ตรวจ token เดิมด้วย /users/me ก่อนถือว่า session ยังใช้ได้
        // ไฟล์ถัดไป: services/api.ts
        const response = await api.get("/users/me");
        setUser(response.data.data);
        setToken(storedToken);
      } catch (error) {
        Logger.error("Failed to fetch user:", error);
        resetAuthState(false);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, [resetAuthState]);

  const login = (newToken: string, newUser: User) => {
    // login ใหม่ต้องล้าง cache เดิมก่อน เพื่อไม่ให้ข้อมูลจาก session ก่อนหน้าแสดงผิด
    queryClient.clear();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    resetAuthState(true);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
