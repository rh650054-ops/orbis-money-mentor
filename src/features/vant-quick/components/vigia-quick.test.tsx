import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "6261573e-d339-466d-b7de-665d2b6c76f4", B = "071d204d-6e19-4cbd-ad0a-6345da37858b";
let usuario: { id: string } | null = { id: A };
let carregando = false;
const chamadas: string[] = [];
let tocar: (() => void) | null = null;
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: usuario, loading: carregando }) }));
vi.mock("../api/ponte", () => ({
  temQuick: () => true,
  quick: {
    limpar: async () => { chamadas.push("limpar"); },
    definirConta: async (c: string | null) => { chamadas.push(`conta:${c}`); },
    salvarConfig: async (v: number | null) => { chamadas.push(`config:${v}`); },
    aoTocarNoWidget: async (f: () => void) => { tocar = f; return { remove: async () => undefined }; },
  },
}));

import { salvarConfig, lerConfig } from "../lib/memoria";
import { VigiaQuick } from "./vigia-quick";

function Onde() { return <p data-testid="rota">{useLocation().pathname}</p>; }
const montar = (rota = "/") => render(<MemoryRouter initialEntries={[rota]}><VigiaQuick /><Routes><Route path="*" element={<Onde />} /></Routes></MemoryRouter>);

beforeEach(() => { chamadas.length = 0; localStorage.clear(); usuario = { id: A }; carregando = false; });

describe("VANT Quick's guard", () => {
  it("stamps the signed-in account and its quick sale for the widget", async () => {
    salvarConfig(A, { valor: 15, metodo: "dinheiro" });
    montar();
    await waitFor(() => expect(chamadas).toEqual([`conta:${A}`, "config:15"]));
  });

  it("signing out: widget data wiped (and the Live Activity ended, natively), memory of that account forgotten, nobody stamped", async () => {
    salvarConfig(A, { valor: 15, metodo: "dinheiro" });
    const r = montar();
    await waitFor(() => expect(chamadas).toContain(`conta:${A}`));
    chamadas.length = 0;
    usuario = null;
    r.rerender(<MemoryRouter><VigiaQuick /></MemoryRouter>);
    await waitFor(() => expect(chamadas).toEqual(["limpar", "conta:null", "config:null"]));
    expect(lerConfig(A)).toBeNull();
  });

  it("switching account: wiped first, then the new account is stamped", async () => {
    const r = montar();
    await waitFor(() => expect(chamadas).toContain(`conta:${A}`));
    chamadas.length = 0;
    usuario = { id: B };
    r.rerender(<MemoryRouter><VigiaQuick /></MemoryRouter>);
    await waitFor(() => expect(chamadas).toEqual(["limpar", `conta:${B}`, "config:null"]));
  });

  it("a widget tap opens the DEFCON (where the tap is executed)", async () => {
    const r = montar("/");
    await waitFor(() => expect(tocar).not.toBeNull());
    act(() => tocar?.());
    expect(r.getByTestId("rota").textContent).toBe("/defcon");
  });
  it("app opening or coming back from the background (session reloading): nothing is wiped", async () => {
    carregando = true; usuario = null;                 // boot: session not restored yet
    const r = montar();
    await act(async () => { await Promise.resolve(); });
    expect(chamadas).toEqual([]);
    carregando = false; usuario = { id: A };           // restored
    r.rerender(<MemoryRouter><VigiaQuick /></MemoryRouter>);
    await waitFor(() => expect(chamadas).toContain(`conta:${A}`));
    chamadas.length = 0;
    carregando = true;                                 // background → foreground: auth refreshes
    r.rerender(<MemoryRouter><VigiaQuick /></MemoryRouter>);
    carregando = false;
    r.rerender(<MemoryRouter><VigiaQuick /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    expect(chamadas).not.toContain("limpar");
  });
});
