// AdminLayout.test.tsx — Unit test สำหรับ layout หลักของ Admin
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminLayout from "../../layouts/AdminLayout";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    logout: jest.fn(),
    user: { firstName: "System", lastName: "Admin", email: "admin@fallhelp.com" },
  }),
}));

jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    toggleTheme: jest.fn(),
  }),
}));

describe("AdminLayout", () => {
  it("labels the default section as a device overview", () => {
    const { getByText } = render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    // ตรวจสอบ subtitle ที่บอกว่านี่คือ admin panel จัดการอุปกรณ์
    expect(getByText("แผงจัดการอุปกรณ์")).toBeInTheDocument();
  });
});
