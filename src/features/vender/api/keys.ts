import { createQueryKeys } from "@/shared/api";

export const venderKeys = createQueryKeys("vender");
export const conciliacaoKey = (uid: string) => [...venderKeys.all, "conciliacao", uid] as const;
export const bancosKey = (uid: string) => [...venderKeys.all, "bancos", uid] as const;
