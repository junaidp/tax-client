"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AppState = {
  token: string | null;
  hmrcToken: string | null;
  nino: string | null;
  businessId: string | null;
  taxYear: string | null;
  calculationId: string | null;
  setToken: (t: string | null) => void;
  setHmrcToken: (t: string | null) => void;
  setNino: (n: string | null) => void;
  setBusinessId: (b: string | null) => void;
  setTaxYear: (y: string | null) => void;
  setCalculationId: (c: string | null) => void;
};

const Ctx = createContext<AppState | undefined>(undefined);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hmrcToken, setHmrcToken] = useState<string | null>(null);
  const [nino, setNino] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState<string | null>(null);
  const [calculationId, setCalculationId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(sessionStorage.getItem("authToken"));
      setHmrcToken(sessionStorage.getItem("hmrcToken"));
      setNino(sessionStorage.getItem("userNino"));
      setBusinessId(sessionStorage.getItem("businessId"));
      setTaxYear(sessionStorage.getItem("taxYear"));
      setCalculationId(sessionStorage.getItem("calculationId"));
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      token,
      hmrcToken,
      nino,
      businessId,
      taxYear,
      calculationId,
      setToken: (t) => {
        setToken(t);
        if (typeof window !== "undefined") {
          if (t) sessionStorage.setItem("authToken", t);
          else sessionStorage.removeItem("authToken");
        }
      },
      setHmrcToken: (t) => {
        setHmrcToken(t);
        if (typeof window !== "undefined") {
          if (t) sessionStorage.setItem("hmrcToken", t);
          else sessionStorage.removeItem("hmrcToken");
        }
      },
      setNino: (n) => {
        setNino(n);
        if (typeof window !== "undefined") {
          if (n) sessionStorage.setItem("userNino", n);
          else sessionStorage.removeItem("userNino");
        }
      },
      setBusinessId: (b) => {
        setBusinessId(b);
        if (typeof window !== "undefined") {
          if (b) sessionStorage.setItem("businessId", b);
          else sessionStorage.removeItem("businessId");
        }
      },
      setTaxYear: (y) => {
        setTaxYear(y);
        if (typeof window !== "undefined") {
          if (y) sessionStorage.setItem("taxYear", y);
          else sessionStorage.removeItem("taxYear");
        }
      },
      setCalculationId: (c) => {
        setCalculationId(c);
        if (typeof window !== "undefined") {
          if (c) sessionStorage.setItem("calculationId", c);
          else sessionStorage.removeItem("calculationId");
        }
      },
    }),
    [token, hmrcToken, nino, businessId, taxYear, calculationId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within StateProvider");
  return ctx;
}

