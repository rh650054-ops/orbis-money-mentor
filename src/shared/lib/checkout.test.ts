import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirCheckout, checkoutAbertoEm, comIdentidade, limparCheckoutAberto, PRO_CHECKOUT } from "./checkout";
import { HOTMART_CHECKOUT_URL } from "./constants";

const UID = "3f2b8c1e-9a7d-4e21-b6c3-0d5e4f6a7b8c";
const CPF_OK = "529.982.247-25"; // valid check digits
const params = (url: string) => new URL(url).searchParams;

describe("comIdentidade (Hotmart prefill)", () => {
  it("keeps off/sck and adds email, name, doc, phone and xcod", () => {
    const url = comIdentidade(HOTMART_CHECKOUT_URL, {
      email: "rick+vant@gmail.com", nome: "Rick Cardoso", cpf: CPF_OK, telefone: "+55 (11) 98765-4321", userId: UID,
    });
    const p = params(url);
    expect(url.startsWith("https://pay.hotmart.com/N104683123F?")).toBe(true);
    expect(p.get("off")).toBe("8qbxvm9p");
    expect(p.get("sck")).toBe("orbis_app");
    expect(p.get("email")).toBe("rick+vant@gmail.com");
    expect(url).toContain("email=rick%2Bvant%40gmail.com"); // "+" must not become a space
    expect(p.get("name")).toBe("Rick Cardoso");
    expect(p.get("doc")).toBe("52998224725");
    expect(p.get("phoneac")).toBe("11");
    expect(p.get("phonenumber")).toBe("987654321");
    expect(p.get("xcod")).toBe(UID);
  });

  it("keeps partner attribution (sck/offDiscount) and checkoutMode intact", () => {
    const base = `${PRO_CHECKOUT.anual}&sck=ZECK15&offDiscount=ZECK15`;
    const p = params(comIdentidade(base, { email: "a@b.com", userId: UID }));
    expect(p.get("sck")).toBe("ZECK15");
    expect(p.get("offDiscount")).toBe("ZECK15");
    expect(p.get("checkoutMode")).toBe("6");
    expect(p.get("off")).toBe("ew11enu0");
  });

  it("skips invalid CPF, bad phone, internal e-mail and empty fields", () => {
    const p = params(comIdentidade(HOTMART_CHECKOUT_URL, {
      email: "52998224725@orbis.internal", nome: "  ", cpf: "123.456.789-00", telefone: "9999", userId: null,
    }));
    for (const k of ["email", "name", "doc", "phoneac", "phonenumber", "xcod"]) expect(p.has(k)).toBe(false);
    expect(params(comIdentidade(HOTMART_CHECKOUT_URL, { cpf: "1234567890" })).has("doc")).toBe(false);
  });

  it("never duplicates a param the link already has", () => {
    const base = `${HOTMART_CHECKOUT_URL}&email=antigo%40x.com`;
    const url = comIdentidade(comIdentidade(base, { email: "novo@x.com", userId: UID }), { userId: UID });
    expect(params(url).getAll("email")).toEqual(["antigo@x.com"]);
    expect(params(url).getAll("xcod")).toEqual([UID]);
    expect(params(url).getAll("sck")).toEqual(["orbis_app"]);
  });
});

describe("abrirCheckout", () => {
  afterEach(() => { vi.restoreAllMocks(); limparCheckoutAberto(); });

  it("opens a new tab, cuts the opener and remembers the tap", () => {
    const aba = { opener: {} as unknown } as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(aba);
    const ouviu = vi.fn();
    window.addEventListener("vant:checkout-aberto", ouviu);
    abrirCheckout("https://pay.hotmart.com/X?off=1");
    expect(open).toHaveBeenCalledWith("https://pay.hotmart.com/X?off=1", "_blank");
    expect(aba.opener).toBeNull();
    expect(checkoutAbertoEm()).not.toBeNull();
    expect(ouviu).toHaveBeenCalled();
    window.removeEventListener("vant:checkout-aberto", ouviu);
  });

  it("falls back to the same window when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const original = window.location;
    const falso = { href: "http://localhost/" };
    Object.defineProperty(window, "location", { configurable: true, value: falso });
    try {
      abrirCheckout("https://pay.hotmart.com/X?off=1");
      expect(falso.href).toBe("https://pay.hotmart.com/X?off=1");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});
