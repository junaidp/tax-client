"use client";
import { useState, useEffect } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

// ----------------- field definitions -----------------
const incomeFields = ["turnover", "other"];
const expenseFields = [
  "costOfGoods",
  "paymentsToSubcontractors",
  "wagesAndStaffCosts",
  "carVanTravelExpenses",
  "premisesRunningCosts",
  "maintenanceCosts",
  "adminCosts",
  "interestOnBankOtherLoans",
  "financeCharges",
  "irrecoverableDebts",
  "professionalFees",
  "depreciation",
  "otherExpenses",
  "advertisingCosts",
  "businessEntertainmentCosts",
  "consolidatedExpenses",
];
const additionFields = [
  "costOfGoodsDisallowable",
  "paymentsToSubcontractorsDisallowable",
  "wagesAndStaffCostsDisallowable",
  "carVanTravelExpensesDisallowable",
  "premisesRunningCostsDisallowable",
  "maintenanceCostsDisallowable",
  "adminCostsDisallowable",
  "interestOnBankOtherLoansDisallowable",
  "financeChargesDisallowable",
  "irrecoverableDebtsDisallowable",
  "professionalFeesDisallowable",
  "depreciationDisallowable",
  "otherExpensesDisallowable",
  "advertisingCostsDisallowable",
  "businessEntertainmentCostsDisallowable",
];

// ----------------- helpers -----------------
function initSection(fields: string[]) {
  return fields.reduce((acc, f) => ({ ...acc, [f]: "" }), {});
}

function cleanSection(section: Record<string, string>) {
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(section)) {
    if (v !== "" && !isNaN(Number(v))) {
      cleaned[k] = Number(v);
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// ----------------- component -----------------
export default function BsasAdjustPage() {
  const { nino, taxYear, hmrcToken } = useAppState();
  const [calculationId, setCalculationId] = useState<string>(
      typeof window !== "undefined"
          ? sessionStorage.getItem("calculationId") || ""
          : ""
  );
  const [localTaxYear, setLocalTaxYear] = useState<string>(taxYear || "");
  const [activeTab, setActiveTab] = useState<"2023" | "2024">("2023");
  const [formData, setFormData] = useState({
    forTY2023_24AndBefore: {
      income: initSection(incomeFields),
      expenses: initSection(expenseFields),
      additions: initSection(additionFields),
    },
    forTY2024_25AndAfter: {
      income: initSection(incomeFields),
      expenses: initSection(expenseFields),
      additions: initSection(additionFields),
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchCalculationId = async (): Promise<string> => {
    const token =
        hmrcToken ||
        (typeof window !== "undefined"
            ? sessionStorage.getItem("hmrcToken")
            : "") ||
        "";
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
    if (!baseUrl) throw new Error("Backend base URL is not configured");

    const response = await axios
        .post(
            `${baseUrl}/api/external/individualCalculationsGetId?nino=${nino}&token=${encodeURIComponent(
                token
            )}&taxYear=${localTaxYear}&calculationType=in-year`,
            {},
            { headers: { "Content-Type": "application/json" } }
        )
        .then((res) => res.data);

    if (response?.calculationId) {
      sessionStorage.setItem("calculationId", response.calculationId);
      setCalculationId(response.calculationId);
      return response.calculationId;
    }

    throw new Error("Failed to fetch calculation ID");
  };

  useEffect(() => {
    if (!calculationId && nino && localTaxYear) {
      fetchCalculationId().catch((e) =>
          setError(e?.message || "Failed to fetch calculation ID")
      );
    }
  }, [calculationId, nino, localTaxYear]);

  const updateField = (
      section: "income" | "expenses" | "additions",
      field: string,
      value: string
  ) => {
    setFormData((prev) => {
      const key =
          activeTab === "2023"
              ? "forTY2023_24AndBefore"
              : "forTY2024_25AndAfter";
      return {
        ...prev,
        [key]: {
          ...prev[key],
          [section]: {
            ...prev[key][section],
            [field]: value,
          },
        },
      };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined"
              ? sessionStorage.getItem("hmrcToken")
              : "") ||
          "";

      let currentCalculationId = calculationId;
      if (!currentCalculationId) {
        currentCalculationId = await fetchCalculationId();
      }

      const params = new URLSearchParams({
        nino: nino || "",
        calculationId: currentCalculationId,
        token,
        taxYear: localTaxYear || "",
      });

      const key =
          activeTab === "2023"
              ? "forTY2023_24AndBefore"
              : "forTY2024_25AndAfter";

      const cleaned = {
        income: cleanSection(formData[key].income),
        expenses: cleanSection(formData[key].expenses),
        additions: cleanSection(formData[key].additions),
      };

      // keep only non-empty sections
      const filtered: Record<string, any> = {};
      for (const [k, v] of Object.entries(cleaned)) {
        if (v !== undefined) filtered[k] = v;
      }

      // only include tab key if it has something
      const body: any = Object.keys(filtered).length > 0 ? filtered : {};

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");
      const headers = getOrGenerateAndPersistFraudHeaders();
      await axios.post(
          `${baseUrl}/api/external/bsasSelfEmploymentAdjust?${params.toString()}`,
          body,
          { headers }
      );

      router.push("/dividends");
    } catch (e: any) {
      setError(e?.message || "Failed to submit BSAS adjustments");
    } finally {
      setLoading(false);
    }
  };

  // ----------------- UI -----------------
  const renderFields = (
      section: "income" | "expenses" | "additions",
      fields: string[]
  ) => {
    const key =
        activeTab === "2023" ? "forTY2023_24AndBefore" : "forTY2024_25AndAfter";
    return (
        <div className="space-y-2">
          {fields.map((f) => (
              <div key={f}>
                <label className="label" htmlFor={f}>
                  {f}
                </label>
                <input
                    id={f}
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData[key][section][f]}
                    onChange={(e) => updateField(section, f, e.target.value)}
                />
              </div>
          ))}
        </div>
    );
  };

  return (
      <StepLayout
          title="Step 24: BSAS Adjustments"
          backHref="/bsas-trigger"
          next={null}
      >
        <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
          {/* Tax Year */}
          <div>
            <label className="label" htmlFor="taxYear">
              Tax year
            </label>
            <input
                id="taxYear"
                className="input"
                value={localTaxYear}
                onChange={(e) => setLocalTaxYear(e.target.value)}
                required
            />
          </div>

          {/* Tabs */}
          <div className="flex space-x-4">
            <button
                type="button"
                className={activeTab === "2023" ? "btn-primary" : "btn-secondary"}
                onClick={() => setActiveTab("2023")}
            >
              For TY 2023–24 and before
            </button>
            <button
                type="button"
                className={activeTab === "2024" ? "btn-primary" : "btn-secondary"}
                onClick={() => setActiveTab("2024")}
            >
              For TY 2024–25 and after
            </button>
          </div>

          {/* Collapsibles */}
          <details open>
            <summary className="font-bold cursor-pointer">Income</summary>
            {renderFields("income", incomeFields)}
          </details>

          <details>
            <summary className="font-bold cursor-pointer">Expenses</summary>
            {renderFields("expenses", expenseFields)}
          </details>

          <details>
            <summary className="font-bold cursor-pointer">Additions</summary>
            {renderFields("additions", additionFields)}
          </details>

          {error && <p className="error">{error}</p>}
          <button
              type="submit"
              className="btn-primary"
              disabled={loading || !calculationId}
          >
            {loading ? "Submitting..." : "Next"}
          </button>
        </form>
      </StepLayout>
  );
}
