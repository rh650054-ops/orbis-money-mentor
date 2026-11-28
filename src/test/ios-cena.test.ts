import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* With scenes, SceneDelegate builds the iOS window, not Main.storyboard. Builds 29 and 30 shipped
   with SceneDelegate creating a plain CAPBridgeViewController: MainViewController never ran, so the
   VANT Quick plugin was never registered and the edge swipe never existed. This keeps it fixed. */
const ler = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("iOS window root", () => {
  it("SceneDelegate builds MainViewController (plugin + back gesture), never a plain Capacitor one", () => {
    const cena = ler("ios/App/App/SceneDelegate.swift");
    expect(cena).toMatch(/rootViewController\s*=\s*MainViewController\(\)/);
    expect(cena).not.toMatch(/rootViewController\s*=\s*CAPBridgeViewController\(\)/);
  });

  it("MainViewController registers VANT Quick and turns the back gesture on", () => {
    const vc = ler("ios/App/App/MainViewController.swift");
    expect(vc).toMatch(/registerPluginInstance\(VantQuickPlugin\(\)\)/);
    expect(vc).toMatch(/allowsBackForwardNavigationGestures\s*=\s*true/);
  });

  it("the storyboard agrees (in case a future change moves the root back to it)", () => {
    expect(ler("ios/App/App/Base.lproj/Main.storyboard")).toMatch(/customClass="MainViewController"/);
  });
});
