// Login.test.tsx — Unit test สำหรับหน้าเข้าสู่ระบบของ Admin
import { fireEvent, waitFor } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../../pages/Login";
import { loginAdmin } from "../../services/adminAuthService";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: jest.fn(),
  }),
}));

jest.mock("../../services/adminAuthService", () => ({
  loginAdmin: jest.fn(),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

describe("Admin Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders login heading and button", () => {
    const { getByText, getByRole } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(getByText("แผงควบคุมผู้ดูแลระบบ")).toBeInTheDocument();
    expect(getByText("อีเมล")).toBeInTheDocument();
    expect(getByRole("button", { name: "เข้าสู่ระบบ" })).toBeInTheDocument();
  });

  it("submits email field only for admin login", async () => {
    const mockLoginAdmin = loginAdmin as jest.Mock;
    mockLoginAdmin.mockResolvedValue({
      token: "admin-token",
      user: { id: "admin-1", email: "admin@fallhelp.com", role: "ADMIN" },
    });

    const { container, getByRole } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, {
      target: { value: "admin@fallhelp.com" },
    });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, {
      target: { value: "secret123" },
    });
    fireEvent.click(getByRole("button", { name: "เข้าสู่ระบบ" }));

    await waitFor(() => {
      expect(mockLoginAdmin).toHaveBeenCalledWith("admin@fallhelp.com", "secret123");
    });
  });

  it("shows an error message when admin login fails", async () => {
    const mockLoginAdmin = loginAdmin as jest.Mock;
    mockLoginAdmin.mockRejectedValue(new Error("role_not_allowed"));

    const { container, getByRole, getByText } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(container.querySelector('input[type="email"]') as HTMLInputElement, {
      target: { value: "user@fallhelp.com" },
    });
    fireEvent.change(container.querySelector('input[type="password"]') as HTMLInputElement, {
      target: { value: "secret123" },
    });
    fireEvent.click(getByRole("button", { name: "เข้าสู่ระบบ" }));

    await waitFor(() => {
      expect(getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeInTheDocument();
    });
  });
});
