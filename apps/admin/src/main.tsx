/**
 * main.tsx
 *
 * จุดเริ่มต้นของ Admin Web
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด global CSS ของแอป
 * - import Root App
 * - mount React app เข้ากับ element id="root" จาก index.html
 */

import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations
        .filter((registration) =>
          registration.active?.scriptURL.endsWith("/device-label-pdf-sw.js")
        )
        .forEach((registration) => {
          void registration.unregister();
        });
    });
  });
}

// root element ถูกสร้างไว้ใน index.html ของ Vite
createRoot(document.getElementById("root")!).render(<App />);
