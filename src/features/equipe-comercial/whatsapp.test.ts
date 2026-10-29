import { describe, expect, it } from "vitest";
import { linkWhatsappLead } from "./lib/whatsapp";

describe("WhatsApp do lead (equipe comercial)", () => {
  it("monta o wa.me com o primeiro nome", () => {
    const l = linkWhatsappLead("5511999990000", "Maria Clara");
    expect(l.startsWith("https://wa.me/5511999990000?text=")).toBe(true);
    expect(decodeURIComponent(l)).toContain("Oi, Maria!");
  });
  it("sem nome, cumprimenta sem nome", () => {
    expect(decodeURIComponent(linkWhatsappLead("5511999990000", null))).toContain("Oi! Aqui é da equipe VANT");
  });
});
