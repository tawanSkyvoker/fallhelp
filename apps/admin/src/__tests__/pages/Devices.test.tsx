// Devices.test.tsx — Unit test สำหรับหน้าจัดการอุปกรณ์ของ Admin
import { fireEvent } from "@testing-library/dom";
import { render } from "@testing-library/react";
import Devices from "../../pages/Devices";
import type { Device } from "../../types";

const mockCreateMutate = jest.fn();
let mockDevices: Device[] = [];

jest.mock("qrcode.react", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const QRCodeSVG = ({ value }: { value: string }) =>
    React.createElement("svg", { "data-testid": "qr-svg", "data-value": value });
  return { QRCodeSVG };
});

jest.mock("../../hooks/useAdminDevices", () => ({
  useAdminDevices: () => ({
    data: mockDevices,
    isLoading: false,
  }),
  useCreateDevice: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useDeleteDevice: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useUnpairDevice: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

describe("Admin Devices", () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockDevices = [];
  });

  it("renders devices heading", () => {
    const { getByText } = render(<Devices />);

    expect(getByText("จัดการอุปกรณ์ (Devices)")).toBeInTheDocument();
  });

  it("normalizes serial number to hardware format before submit", () => {
    const { getAllByRole, getByLabelText } = render(<Devices />);
    const [openButton] = getAllByRole("button", { name: "ลงทะเบียนอุปกรณ์" });

    fireEvent.click(openButton!);
    fireEvent.change(getByLabelText("หมายเลขอุปกรณ์"), {
      target: { value: "esp32-6c689bdaf380" },
    });
    const [, submitButton] = getAllByRole("button", { name: "ลงทะเบียนอุปกรณ์" });
    fireEvent.click(submitButton!);

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { serialNumber: "ESP32-6C689BDAF380" },
      expect.any(Object)
    );
  });

  it("keeps submit disabled when serial number is incomplete", () => {
    const { getAllByRole, getByLabelText } = render(<Devices />);
    const [openButton] = getAllByRole("button", { name: "ลงทะเบียนอุปกรณ์" });

    fireEvent.click(openButton!);
    fireEvent.change(getByLabelText("หมายเลขอุปกรณ์"), {
      target: { value: "ESP32-1234" },
    });

    const [, submitButton] = getAllByRole("button", { name: "ลงทะเบียนอุปกรณ์" });
    expect(submitButton).toBeDisabled();
  });

  it("triggers browser print for the selected device label", () => {
    mockDevices = [
      {
        id: "device-1",
        serialNumber: "ESP32-6C689BDAF380",
        deviceCode: "23D3598B",
        status: "UNPAIRED",
        onlineStatus: "OFFLINE",
        isOnline: false,
        lastOnline: null,
        elderId: null,
      },
    ];

    const printSpy = jest.spyOn(window, "print").mockImplementation(() => undefined);

    const { getByRole, getByTitle, getAllByTestId } = render(<Devices />);

    fireEvent.click(getByTitle("ดู QR Code"));
    fireEvent.click(getByRole("button", { name: "พิมพ์ป้าย" }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    // 1 ดวงใน modal + 6 ดวงใน DeviceLabelSheet (3×2) = 7
    const labelQrCount = getAllByTestId("qr-svg").filter(
      (node) => node.getAttribute("data-value") === "23D3598B"
    ).length;
    expect(labelQrCount).toBe(7);

    printSpy.mockRestore();
  });
});
