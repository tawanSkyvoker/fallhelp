/**
 * configValidator Utility Tests (Admin)
 * Tests: environment variable validation and runtime config integrity
 */
import { validateConfig } from "../../utils/configValidator";

describe("validateConfig", () => {
  it("returns error when API_URL missing", () => {
    const result = validateConfig({ API_URL: "" });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API_URL is required");
  });

  it("returns error when API_URL invalid", () => {
    const result = validateConfig({ API_URL: "ftp://example.com" });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("API_URL has invalid format");
  });

  it("accepts valid API_URL", () => {
    const result = validateConfig({ API_URL: "https://api.example.com" });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
