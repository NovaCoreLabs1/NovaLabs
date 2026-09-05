import { describe, it, expect } from "vitest";
import { sanitizeRedirect } from "./utils";

describe("sanitizeRedirect", () => {
  it("accepts a valid internal path", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("/admin/users")).toBe("/admin/users");
    expect(sanitizeRedirect("/projects/123/edit")).toBe("/projects/123/edit");
  });

  it("rejects absolute https URLs", () => {
    expect(sanitizeRedirect("https://evil.com")).toBeNull();
    expect(sanitizeRedirect("https://example.com/dashboard")).toBeNull();
  });

  it("rejects absolute http URLs", () => {
    expect(sanitizeRedirect("http://evil.com")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeRedirect("//evil.com")).toBeNull();
    expect(sanitizeRedirect("//evil.com/dashboard")).toBeNull();
  });

  it("rejects javascript: payloads", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBeNull();
    expect(sanitizeRedirect("javascript://alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(sanitizeRedirect("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects empty strings", () => {
    expect(sanitizeRedirect("")).toBeNull();
  });

  it("rejects null", () => {
    expect(sanitizeRedirect(null)).toBeNull();
  });

  it("rejects paths without leading slash", () => {
    expect(sanitizeRedirect("dashboard")).toBeNull();
    expect(sanitizeRedirect("../etc/passwd")).toBeNull();
  });

  it("rejects double-leading-slash paths", () => {
    expect(sanitizeRedirect("//dashboard")).toBeNull();
  });

  it("rejects control characters", () => {
    expect(sanitizeRedirect("/dash\x00board")).toBeNull();
    expect(sanitizeRedirect("/dash\nboard")).toBeNull();
  });

  it("rejects mailto: and ftp: schemes", () => {
    expect(sanitizeRedirect("mailto:attacker@evil.com")).toBeNull();
    expect(sanitizeRedirect("ftp://evil.com")).toBeNull();
  });
});
