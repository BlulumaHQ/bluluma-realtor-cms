import { createContext, useContext } from "react";
import type { Realtor } from "./types";

type Ctx = { realtor: Realtor | null; preview: boolean };
const RealtorContext = createContext<Ctx | null>(null);

export function RealtorProvider({ realtor, preview = false, children }: { realtor: Realtor | null; preview?: boolean; children: React.ReactNode }) {
  return <RealtorContext.Provider value={{ realtor, preview }}>{children}</RealtorContext.Provider>;
}

export function useRealtorContext() {
  return useContext(RealtorContext);
}
