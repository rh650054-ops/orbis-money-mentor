/* Mounted once in the router: shows the welcome tour on the store app's first open,
   above login or the app (whatever is behind it), then never again on this install. */
import { useState } from "react";
import { deveMostrarBoasVindas, marcarBoasVindasVista } from "../lib/visto";
import { BoasVindas } from "./boas-vindas";

export function BoasVindasGate() {
  const [aberto, setAberto] = useState(() => deveMostrarBoasVindas());
  if (!aberto) return null;
  return <BoasVindas onFim={() => { marcarBoasVindasVista(); setAberto(false); }} />;
}
