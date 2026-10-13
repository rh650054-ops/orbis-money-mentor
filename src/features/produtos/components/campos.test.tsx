import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Contador } from "./campos";

describe("Contador", () => {
  it("deixa apagar o 1 e digitar 6 (Rick, 13/10); o mínimo só vale ao sair do campo", () => {
    const onChange = vi.fn();
    render(<Contador rotulo="Rende" valor={1} min={1} onChange={onChange} />);
    const campo = screen.getByLabelText("Rende") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "" } });
    expect(campo.value).toBe("");
    fireEvent.change(campo, { target: { value: "6" } });
    expect(onChange).toHaveBeenLastCalledWith(6);
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
