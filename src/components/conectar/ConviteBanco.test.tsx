import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConviteBanco } from "./ConviteBanco";

describe("ConviteBanco", () => {
  it("has one decision: connect the bank", () => {
    const onConectar = vi.fn();
    render(<ConviteBanco onConectar={onConectar} />);
    fireEvent.click(screen.getByText("CONECTAR MEU BANCO"));
    expect(onConectar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("X1 e Sala de Competição")).toBeInTheDocument();
  });
});
