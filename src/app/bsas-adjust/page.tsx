"use client";
import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";

// ----------------- Self-Employment Field Definitions -----------------
const SE_INCOME_FIELDS = ["turnover", "other"];
const SE_EXPENSE_FIELDS = [
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
const SE_ADDITION_FIELDS = [
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

// ----------------- UK Property Field Definitions -----------------
const UKP_INCOME_FIELDS = [
  "totalRentsReceived",
  "premiumsOfLeaseGrant",
  "reversePremiums",
  "otherPropertyIncome",
];
const UKP_EXPENSE_FIELDS = [
  "consolidatedExpenses",
  "premisesRunningCosts",
  "repairsAndMaintenance",
  "financialCosts",
  "professionalFees",
  "costOfServices",
  "residentialFinancialCost",
  "other",
  "travelCosts",
];

// ----------------- Foreign Property Field Definitions -----------------
const FP_INCOME_FIELDS = [
  "totalRentsReceived",
  "premiumsOfLeaseGrant",
  "otherPropertyIncome",
];
const FP_EXPENSE_FIELDS = [
  "consolidatedExpenses",
  "premisesRunningCosts",
  "repairsAndMaintenance",
  "financialCosts",
  "professionalFees",
  "costOfServices",
  "residentialFinancialCost",
  "other",
  "travelCosts",
];

type SubmissionType = "selfEmployment" | "ukProperty" | "foreignProperty";

// Foreign Property Entry Type
type FPEntry = {
  id: string;
  countryCode: string;
  income: Record<string, string>;
  expenses: Record<string, string>;
};

export default function BsasAdjustPage() {
  const { nino, taxYear, hmrcToken } = useAppState();
  const router = useRouter();

  const [calculationId, setCalculationId] = useState<string>(
      typeof window !== "undefined"
          ? sessionStorage.getItem("calculationId") || ""
          : ""
  );
  const [localTaxYear, setLocalTaxYear] = useState<string>(taxYear || "");
  const [submissionType, setSubmissionType] = useState<SubmissionType>("selfEmployment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Self-Employment Tab Selector (2023 vs 2024)
  const [seActiveTab, setSeActiveTab] = useState<"2023" | "2024">("2024");

  // Self-Employment States
  const [seData, setSeData] = useState({
    forTY2023_24AndBefore: {
      income: Object.fromEntries(SE_INCOME_FIELDS.map(f => [f, ""])),
      expenses: Object.fromEntries(SE_EXPENSE_FIELDS.map(f => [f, ""])),
      additions: Object.fromEntries(SE_ADDITION_FIELDS.map(f => [f, ""])),
    },
    forTY2024_25AndAfter: {
      income: Object.fromEntries(SE_INCOME_FIELDS.map(f => [f, ""])),
      expenses: Object.fromEntries(SE_EXPENSE_FIELDS.map(f => [f, ""])),
      additions: Object.fromEntries(SE_ADDITION_FIELDS.map(f => [f, ""])),
    },
  });

  // UK Property States
  const [ukpIncome, setUkpIncome] = useState<Record<string, string>>(
      Object.fromEntries(UKP_INCOME_FIELDS.map(f => [f, ""]))
  );
  const [ukpExpenses, setUkpExpenses] = useState<Record<string, string>>(
      Object.fromEntries(UKP_EXPENSE_FIELDS.map(f => [f, ""]))
  );
  const [ukpZeroAdjustments, setUkpZeroAdjustments] = useState(false);

  // Foreign Property States
  const [foreignProperties, setForeignProperties] = useState<FPEntry[]>([
    {
      id: Date.now().toString(),
      countryCode: "",
      income: Object.fromEntries(FP_INCOME_FIELDS.map(f => [f, ""])),
      expenses: Object.fromEntries(FP_EXPENSE_FIELDS.map(f => [f, ""])),
    },
  ]);

  // Fetch calculation ID if needed
  const fetchCalculationId = async (): Promise<string> => {
    const token =
        hmrcToken ||
        (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") ||
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

  // Helper function to clean sections (remove empty values)
  const cleanSection = (section: Record<string, string>) => {
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(section)) {
      const numValue = Number(v);
      if (v !== "" && !isNaN(numValue) && numValue !== 0) {
        cleaned[k] = numValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };

  // Self-Employment field handler
  const handleSeFieldChange = useCallback(
      (
          section: "income" | "expenses" | "additions",
          field: string,
          value: string
      ) => {
        setSeData((prev) => {
          const key = seActiveTab === "2023" ? "forTY2023_24AndBefore" : "forTY2024_25AndAfter";
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
      },
      [seActiveTab]
  );

  // UK Property field handler
  const handleUkpFieldChange = useCallback(
      (section: "income" | "expenses", field: string, value: string) => {
        if (section === "income") {
          setUkpIncome(prev => ({ ...prev, [field]: value }));
        } else {
          setUkpExpenses(prev => ({ ...prev, [field]: value }));
        }
      },
      []
  );

  // Foreign Property field handler
  const handleFpFieldChange = useCallback(
      (
          entryIndex: number,
          section: "income" | "expenses",
          field: string,
          value: string
      ) => {
        setForeignProperties(prev => {
          const newFPs = [...prev];
          newFPs[entryIndex] = {
            ...newFPs[entryIndex],
            [section]: {
              ...newFPs[entryIndex][section],
              [field]: value,
            },
          };
          return newFPs;
        });
      },
      []
  );

  // Render input field helper
  const renderInputField = (
      id: string,
      value: string,
      onChange: (value: string) => void,
      label?: string
  ) => {
    const displayLabel = label || id.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());

    return (
        <div className="mb-2" key={id}>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>
            {displayLabel} <span className="text-gray-400 text-xs">(£, optional)</span>
          </label>
          <input
              id={id}
              type="number"
              step="0.01"
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              min="-99999999999.99"
              max="99999999999.99"
          />
        </div>
    );
  };

  // Submit handler
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") ||
          "";

      let currentCalculationId = calculationId;
      if (!currentCalculationId) {
        currentCalculationId = await fetchCalculationId();
      }

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");

      const headers = getOrGenerateAndPersistFraudHeaders();
      let endpoint = "";
      let requestBody: any = {};

      if (submissionType === "selfEmployment") {
        endpoint = "/api/external/bsasSelfEmploymentAdjust";
        const key = seActiveTab === "2023" ? "forTY2023_24AndBefore" : "forTY2024_25AndAfter";

        const cleaned = {
          income: cleanSection(seData[key].income),
          expenses: cleanSection(seData[key].expenses),
          additions: cleanSection(seData[key].additions),
        };

        for (const [k, v] of Object.entries(cleaned)) {
          if (v !== undefined) requestBody[k] = v;
        }

      } else if (submissionType === "ukProperty") {
        endpoint = "/api/external/bsasUKPropertyAdjust";

        const cleanedIncome = cleanSection(ukpIncome);
        const cleanedExpenses = cleanSection(ukpExpenses);

        requestBody.ukProperty = {};

        if (cleanedIncome) requestBody.ukProperty.income = cleanedIncome;
        if (cleanedExpenses) requestBody.ukProperty.expenses = cleanedExpenses;

        if (ukpZeroAdjustments) {
          requestBody.ukProperty.zeroAdjustments = true;
        }

      } else {
        // foreignProperty
        endpoint = "/api/external/bsasForeignPropertyAdjust";

        const fpArray = foreignProperties
            .filter(fp => fp.countryCode)
            .map(fp => {
              const cleanedIncome = cleanSection(fp.income);
              const cleanedExpenses = cleanSection(fp.expenses);

              const entry: any = {
                countryCode: fp.countryCode,
              };

              if (cleanedIncome) entry.income = cleanedIncome;
              if (cleanedExpenses) entry.expenses = cleanedExpenses;

              return entry;
            })
            .filter(fp => fp.income || fp.expenses);

        if (fpArray.length === 0 && foreignProperties.length > 0) {
          throw new Error("Foreign Property submission requires at least one entry with a Country Code and data.");
        }

        requestBody.foreignProperty = {
          countryLevelDetail: fpArray,
        };
      }

      if (Object.keys(requestBody).length === 0) {
        throw new Error("No data entered for submission.");
      }

      const params = new URLSearchParams({
        nino: nino || "",
        calculationId: currentCalculationId,
        token,
        taxYear: localTaxYear || "",
      });

      await axios.post(
          `${baseUrl}${endpoint}?${params.toString()}`,
          requestBody,
          { headers }
      );

      router.push("/dividends");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit BSAS adjustments");
    } finally {
      setLoading(false);
    }
  };

  // Render Self-Employment Tab
  const renderSelfEmploymentTab = () => {
    const key = seActiveTab === "2023" ? "forTY2023_24AndBefore" : "forTY2024_25AndAfter";

    return (
        <>
          {/* Tax Year Selector for Self-Employment */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
            <p className="text-sm font-medium text-blue-900 mb-3">Select Tax Year Period:</p>
            <div className="flex gap-2">
              <button
                  type="button"
                  onClick={() => setSeActiveTab("2023")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                      seActiveTab === "2023"
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-white text-gray-700 border hover:bg-gray-50"
                  }`}
              >
                For TY 2023–24 and before
              </button>
              <button
                  type="button"
                  onClick={() => setSeActiveTab("2024")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                      seActiveTab === "2024"
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-white text-gray-700 border hover:bg-gray-50"
                  }`}
              >
                For TY 2024–25 and after
              </button>
            </div>
          </div>

          <details className="bg-white p-6 rounded-lg shadow-md border" open>
            <summary className="cursor-pointer font-semibold text-lg text-gray-800">Income</summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {SE_INCOME_FIELDS.map(field =>
                  renderInputField(
                      field,
                      seData[key].income[field],
                      (value) => handleSeFieldChange("income", field, value)
                  )
              )}
            </div>
          </details>

          <details className="bg-white p-6 rounded-lg shadow-md border" open>
            <summary className="cursor-pointer font-semibold text-lg text-gray-800">Expenses</summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {SE_EXPENSE_FIELDS.map(field =>
                  renderInputField(
                      field,
                      seData[key].expenses[field],
                      (value) => handleSeFieldChange("expenses", field, value)
                  )
              )}
            </div>
          </details>

          <details className="bg-white p-6 rounded-lg shadow-md border">
            <summary className="cursor-pointer font-semibold text-lg text-gray-800">Additions (Disallowable Expenses)</summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {SE_ADDITION_FIELDS.map(field =>
                  renderInputField(
                      field,
                      seData[key].additions[field],
                      (value) => handleSeFieldChange("additions", field, value)
                  )
              )}
            </div>
          </details>
        </>
    );
  };

  // Render UK Property Tab
  const renderUKPropertyTab = () => (
      <>
        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Income</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {UKP_INCOME_FIELDS.map(field =>
                renderInputField(
                    field,
                    ukpIncome[field],
                    (value) => handleUkpFieldChange("income", field, value)
                )
            )}
          </div>
        </details>

        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Expenses</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {UKP_EXPENSE_FIELDS.map(field =>
                renderInputField(
                    field,
                    ukpExpenses[field],
                    (value) => handleUkpFieldChange("expenses", field, value)
                )
            )}
          </div>
        </details>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={ukpZeroAdjustments}
                onChange={(e) => setUkpZeroAdjustments(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
            Zero Adjustments (Indicates zero adjustments for all income and expenses)
          </span>
          </label>
        </div>
      </>
  );

  // Render Foreign Property Tab
  const renderForeignPropertyTab = () => (
      <>
        {foreignProperties.map((entry, idx) => (
            <div key={entry.id} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <h3 className="font-semibold text-lg">Foreign Property Entry #{idx + 1}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country Code (ISO 3166-1 alpha-3) <span className="text-red-500">*</span>
                  </label>
                  <input
                      type="text"
                      className="w-full p-2 border rounded-md"
                      value={entry.countryCode}
                      onChange={(e) => {
                        const copy = [...foreignProperties];
                        copy[idx].countryCode = e.target.value.toUpperCase();
                        setForeignProperties(copy);
                      }}
                      placeholder="e.g. FRA"
                      maxLength={3}
                  />
                </div>
                <div>{/* Placeholder */}</div>
              </div>

              <details className="border rounded p-3" open>
                <summary className="cursor-pointer font-medium text-gray-800">Income</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FP_INCOME_FIELDS.map(field =>
                      renderInputField(
                          `${field}-${idx}`,
                          entry.income[field],
                          (value) => handleFpFieldChange(idx, "income", field, value)
                      )
                  )}
                </div>
              </details>

              <details className="border rounded p-3" open>
                <summary className="cursor-pointer font-medium text-gray-800">Expenses</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FP_EXPENSE_FIELDS.map(field =>
                      renderInputField(
                          `${field}-${idx}`,
                          entry.expenses[field],
                          (value) => handleFpFieldChange(idx, "expenses", field, value)
                      )
                  )}
                </div>
              </details>

              <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                    disabled={foreignProperties.length === 1}
                    onClick={() => setForeignProperties(prev => prev.filter((_, i) => i !== idx))}
                >
                  Remove Entry
                </button>
              </div>
            </div>
        ))}
        <button
            type="button"
            onClick={() =>
                setForeignProperties(prev => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    countryCode: "",
                    income: Object.fromEntries(FP_INCOME_FIELDS.map(f => [f, ""])),
                    expenses: Object.fromEntries(FP_EXPENSE_FIELDS.map(f => [f, ""])),
                  },
                ])
            }
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >
          + Add Another Foreign Property Entry
        </button>
      </>
  );

  return (
      <StepLayout title="Step 24: BSAS Adjustments" backHref="/bsas-trigger" next={null}>
        <form onSubmit={onSubmit} className="space-y-6 max-w-4xl mx-auto">
          {/* Tax Year Input */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="font-semibold mb-3 text-lg">Tax Year</p>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taxYearInput">
                Tax Year (e.g., 2024-25)
              </label>
              <input
                  id="taxYearInput"
                  type="text"
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 2024-25"
                  value={localTaxYear}
                  onChange={(e) => setLocalTaxYear(e.target.value.trim())}
                  required
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
                onClick={() => setSubmissionType("selfEmployment")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "selfEmployment"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              Self-Employment
            </button>
            <button
                onClick={() => setSubmissionType("ukProperty")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "ukProperty"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              UK Property
            </button>
            <button
                onClick={() => setSubmissionType("foreignProperty")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "foreignProperty"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              Foreign Property
            </button>
          </div>

          {/* Tab Content */}
          {submissionType === "selfEmployment" && renderSelfEmploymentTab()}
          {submissionType === "ukProperty" && renderUKPropertyTab()}
          {submissionType === "foreignProperty" && renderForeignPropertyTab()}

          {error && (
              <div className="text-red-500 text-sm mt-2 p-3 border border-red-300 bg-red-50 rounded">
                {error}
              </div>
          )}

          <div className="flex justify-end pt-4">
            <button
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                type="submit"
                disabled={loading || !calculationId}
            >
              {loading ? "Submitting..." : "Next"}
            </button>
          </div>
        </form>
      </StepLayout>
  );
}