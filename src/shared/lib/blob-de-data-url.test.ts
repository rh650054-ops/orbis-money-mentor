import { describe, expect, it } from "vitest";
import { blobDeDataUrl } from "./blob-de-data-url";

describe("blobDeDataUrl", () => {
  it("decodifica PNG base64 byte a byte, com o tipo certo", async () => {
    const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00];
    const b64 = btoa(String.fromCharCode(...bytes));
    const blob = blobDeDataUrl(`data:image/png;base64,${b64}`);
    expect(blob.type).toBe("image/png");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual(bytes);
  });

  it("aceita data URL sem base64 (SVG)", async () => {
    const blob = blobDeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg/>")}`);
    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toBe("<svg/>");
  });

  it("recusa o que não é data URL", () => {
    expect(() => blobDeDataUrl("https://x.co/a.png")).toThrow("data_url_invalido");
  });
});
