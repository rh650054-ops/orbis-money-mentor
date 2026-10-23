import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfirmarZerarDia } from "./confirmar-zerar-dia";

describe("ConfirmarZerarDia", () => {
  it("shows what is lost and only deletes after typing ZERAR", () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmarZerarDia total={722.65} onConfirmar={onConfirmar} onCancelar={() => {}} />);
    expect(screen.getByText(/Você vai perder/)).toHaveTextContent("722,65");
    const apagar = screen.getByRole("button", { name: /Apagar o dia/ });
    expect(apagar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/DIGITE ZERAR/), { target: { value: "zerar" } });
    expect(apagar).toBeEnabled();
    fireEvent.click(apagar);
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });
});
