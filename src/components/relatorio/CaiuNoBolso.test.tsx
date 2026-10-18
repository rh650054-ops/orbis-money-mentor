import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaiuNoBolso } from "./CaiuNoBolso";

describe("CaiuNoBolso", () => {
  it("shows what fell in green and what is still missing in red", () => {
    render(<CaiuNoBolso vendido={581} caiu={461} rotuloFaltou="Falta cair" compacto />);
    expect(screen.getByText("Caiu no bolso")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?461,00/)).toBeInTheDocument();
    expect(screen.getByText(/Vendido R\$\s?581,00/)).toBeInTheDocument();
    expect(screen.getByText(/Falta cair R\$\s?120,00/)).toBeInTheDocument();
    expect(screen.getByText("79% de tudo que você vendeu já entrou")).toBeInTheDocument();
  });

  it("celebrates when everything fell", () => {
    render(<CaiuNoBolso vendido={100} caiu={100} compacto />);
    expect(screen.getByText("caiu tudo 🎉")).toBeInTheDocument();
    expect(screen.getByText("100% de tudo que você vendeu já entrou")).toBeInTheDocument();
  });
});
