import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DadoPro } from "./dado-pro";

describe("DadoPro", () => {
  it("Pro vê o dado normal", () => {
    render(<MemoryRouter><DadoPro travado={false}><p>R$ 96/hora</p></DadoPro></MemoryRouter>);
    expect(screen.getByText("R$ 96/hora")).toBeVisible();
    expect(screen.queryByText("Só no VANT Pro")).toBeNull();
  });

  it("Essencial vê fosco com o selo do Pro", () => {
    render(<MemoryRouter><DadoPro travado><p>R$ 96/hora</p></DadoPro></MemoryRouter>);
    expect(screen.getByText("Só no VANT Pro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Só no VANT Pro/ })).toBeInTheDocument();
  });
});
