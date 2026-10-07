import { describe, expect, it, vi, beforeEach } from "vitest";

const cap = vi.hoisted(() => ({ native: false, platform: "web" }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    getPlatform: () => cap.platform,
  },
}));

import { plataforma, ehAppDaLoja, podeUsarCheckoutWeb } from "./platform";

describe("platform", () => {
  beforeEach(() => {
    cap.native = false;
    cap.platform = "web";
  });

  it("browser/PWA is web and may use the Hotmart checkout", () => {
    expect(plataforma()).toBe("web");
    expect(ehAppDaLoja()).toBe(false);
    expect(podeUsarCheckoutWeb()).toBe(true);
  });

  it("Android store build blocks the web checkout", () => {
    cap.native = true;
    cap.platform = "android";
    expect(plataforma()).toBe("android");
    expect(ehAppDaLoja()).toBe(true);
    expect(podeUsarCheckoutWeb()).toBe(false);
  });

  it("iOS store build blocks the web checkout", () => {
    cap.native = true;
    cap.platform = "ios";
    expect(plataforma()).toBe("ios");
    expect(podeUsarCheckoutWeb()).toBe(false);
  });
});
