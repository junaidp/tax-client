"use client";
import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";
// Added icons for List Summaries and Trigger Summary/Business Selector
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon, InformationCircleIcon, BriefcaseIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";

// ----------------- Self-Employment Field Definitions -----------------
const SE_INCOME_FIELDS = ["turnover", "other"];
const SE_EXPENSE_FIELDS = [
  "costOfGoods", "paymentsToSubcontractors", "wagesAndStaffCosts", "carVanTravelExpenses",
  "premisesRunningCosts", "maintenanceCosts", "adminCosts", "interestOnBankOtherLoans",
  "financeCharges", "irrecoverableDebts", "professionalFees", "depreciation",
  "otherExpenses", "advertisingCosts", "businessEntertainmentCosts", "consolidatedExpenses",
];
const SE_ADDITION_FIELDS = [
  "costOfGoodsDisallowable", "paymentsToSubcontractorsDisallowable", "wagesAndStaffCostsDisallowable",
  "carVanTravelExpensesDisallowable", "premisesRunningCostsDisallowable", "maintenanceCostsDisallowable",
  "adminCostsDisallowable", "interestOnBankOtherLoansDisallowable", "financeChargesDisallowable",
  "irrecoverableDebtsDisallowable", "professionalFeesDisallowable", "depreciationDisallowable",
  "otherExpensesDisallowable", "advertisingCostsDisallowable", "businessEntertainmentCostsDisallowable",
];

// ----------------- UK Property Field Definitions -----------------
const UKP_INCOME_FIELDS = [
  "totalRentsReceived", "premiumsOfLeaseGrant", "reversePremiums", "otherPropertyIncome",
];
const UKP_EXPENSE_FIELDS = [
  "consolidatedExpenses", "premisesRunningCosts", "repairsAndMaintenance", "financialCosts",
  "professionalFees", "costOfServices", "residentialFinancialCost", "other", "travelCosts",
];

// ----------------- Foreign Property Field Definitions -----------------
const FP_INCOME_FIELDS = [
  "totalRentsReceived", "premiumsOfLeaseGrant", "otherPropertyIncome",
];
const FP_EXPENSE_FIELDS = [
  "consolidatedExpenses", "premisesRunningCosts", "repairsAndMaintenance", "financialCosts",
  "professionalFees", "costOfServices", "residentialFinancialCost", "other", "travelCosts",
];

type SubmissionType = "selfEmployment" | "ukProperty" | "foreignProperty";

// Foreign Property Entry Type
type FPEntry = {
  id: string;
  countryCode: string;
  income: Record<string, string>;
  expenses: Record<string, string>;
};

// Define types and data for the Trigger Summary Business Type Selector
type TriggerBusinessType = "self-employment" | "uk-property" | "foreign-property";
const TRIGGER_BUSINESS_TYPES: { id: TriggerBusinessType, label: string, icon: React.ElementType }[] = [
  { id: "self-employment", label: "Self-Employment", icon: BriefcaseIcon },
  { id: "uk-property", label: "UK Property", icon: BuildingOffice2Icon },
  { id: "foreign-property", label: "Foreign Property", icon: BuildingOffice2Icon },
];

export default function BsasAdjustPage() {
  // Destructure businessId from useAppState for default value
  const { nino, taxYear, hmrcToken, businessId: appBusinessId } = useAppState();
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

  // NEW STATES FOR SUMMARIES
  const [listSummariesExpanded, setListSummariesExpanded] = useState(false);
  const [listSummariesLoading, setListSummariesLoading] = useState(false);
  const [summariesData, setSummariesData] = useState<any>(null);

  const [triggerSummaryExpanded, setTriggerSummaryExpanded] = useState(false);
  const [triggerSummaryLoading, setTriggerSummaryLoading] = useState(false);
  // Initialise businessId with appBusinessId (if available) and add businessType state
  const [triggerSummaryInputs, setTriggerSummaryInputs] = useState({
    startDate: "",
    endDate: "",
    businessId: appBusinessId || "", // DEFAULT FROM APP STATE
    businessType: "self-employment" as TriggerBusinessType,
  });

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

  // Fetch calculation ID
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

  // Handle setting businessId from app state if it wasn't available on first render
  useEffect(() => {
    if (appBusinessId && triggerSummaryInputs.businessId === "") {
      setTriggerSummaryInputs(prev => ({ ...prev, businessId: appBusinessId }));
    }
  }, [appBusinessId]);


  // List Summaries API Handler (GET /api/external/listAdjustableSummaries)
  const handleListSummaries = async () => {
    if (listSummariesExpanded && summariesData) {
      setListSummariesExpanded(false);
      return;
    }
    setListSummariesExpanded(true);
    if (summariesData) return; // Already fetched and just expanded/collapsed

    setListSummariesLoading(true);
    setError(null);

    try {
      const token = hmrcToken || (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") || "";
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");

      const headers = getOrGenerateAndPersistFraudHeaders();
      const response = await axios.get(`${baseUrl}/api/external/listAdjustableSummaries`, {
        params: {
          nino: nino,
          token: token,
          taxYear: localTaxYear, // Use the taxYear from the main panel
        },
        headers,
      });

      setSummariesData(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to list summaries");
      setListSummariesExpanded(false);
    } finally {
      setListSummariesLoading(false);
    }
  };

  // Trigger Summary API Handler (POST /api/external/triggerAdjustableSummary)
  // FIX: Removed event parameter and e.preventDefault() to ensure it fires on standard button click
  const handleTriggerSummary = async () => {
    setTriggerSummaryLoading(true);
    setError(null);

    // Validation
    if (!triggerSummaryInputs.startDate || !triggerSummaryInputs.endDate || !triggerSummaryInputs.businessId || !triggerSummaryInputs.businessType) {
      setError("Accounting Period Start/End Date, Business ID, and Business Type are required to trigger a summary.");
      setTriggerSummaryLoading(false);
      return;
    }

    try {
      const token = hmrcToken || (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") || "";
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");

      const requestBody = {
        accountingPeriod: {
          startDate: triggerSummaryInputs.startDate,
          endDate: triggerSummaryInputs.endDate,
        },
        typeOfBusiness: triggerSummaryInputs.businessType,
        businessId: triggerSummaryInputs.businessId,
      };

      const headers = getOrGenerateAndPersistFraudHeaders();

      await axios.post(
          `${baseUrl}/api/external/triggerAdjustableSummary`,
          requestBody,
          {
            params: {
              nino: nino,
              token: token,
            },
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
          }
      );

      alert("Successfully triggered summary calculation. Check 'List Summaries' after a short delay.");
      setTriggerSummaryInputs(prev => ({
        ...prev,
        businessId: appBusinessId || "", // Reset to default or empty
        startDate: "",
        endDate: "",
      }));
      setTriggerSummaryExpanded(false); // Collapse on success
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to trigger summary");
    } finally {
      setTriggerSummaryLoading(false);
    }
  };


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

  // Self-Employment field handler (omitted for brevity - unchanged)
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

  // UK Property field handler (omitted for brevity - unchanged)
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

  // Foreign Property field handler (omitted for brevity - unchanged)
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

  // Render input field helper (omitted for brevity - unchanged)
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

  // Submit handler (omitted for brevity - unchanged)
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

  // Render Self-Employment Tab (omitted for brevity - unchanged)
  const renderSelfEmploymentTab = () => {
    const key = seActiveTab === "2023" ? "forTY2023_24AndBefore" : "forTY2024_25AndAfter";
    // ... rest of the function (Self-Employment UI)
    return (
        <>

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

  // Render UK Property Tab (omitted for brevity - unchanged)
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

  // Render Foreign Property Tab (omitted for brevity - unchanged)
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

  // Render the summary data in a nicely formatted collapsible section
  const renderSummariesData = () => {
    if (listSummariesLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-6">
            <ArrowPathIcon className="animate-spin h-8 w-8 text-purple-600 mb-3" />
            <p className="text-gray-600">Fetching adjustable summaries...</p>
          </div>
      );
    }
    if (!summariesData || summariesData.businessSources?.length === 0) {
      return (
          <p className="text-sm text-gray-600">No adjustable summaries found for Tax Year {localTaxYear}.</p>
      );
    }

    return (
        <div className="space-y-4">
          {summariesData.businessSources.map((source: any, sourceIndex: number) => (
              <div key={sourceIndex} className="p-4 bg-white rounded-lg border border-purple-100 shadow-inner">
                <p className="text-sm font-semibold text-gray-900">Business: {source.typeOfBusiness} ({source.businessId})</p>
                <p className="text-xs text-gray-600 mb-2">Accounting Period: {source.accountingPeriod.startDate} to {source.accountingPeriod.endDate}</p>
                <h6 className="text-sm font-medium mt-2 mb-1">Summaries:</h6>
                <div className="space-y-1">
                  {source.summaries.map((summary: any, summaryIndex: number) => (
                      <div key={summaryIndex} className={`p-3 rounded-md text-xs ${summary.summaryStatus === 'valid' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <p>Calculation ID: <span className="font-mono text-gray-700">{summary.calculationId}</span></p>
                        <p>Status: <span className="font-semibold">{summary.summaryStatus.toUpperCase()}</span></p>
                        <p>Requested: {new Date(summary.requestedDateTime).toLocaleString()}</p>
                        {summary.adjustedSummary && (
                            <p className="text-red-600">Adjusted: Yes (on {new Date(summary.adjustedDateTime).toLocaleString()})</p>
                        )}
                      </div>
                  ))}
                </div>
              </div>
          ))}
        </div>
    );
  };


  return (
      <StepLayout title="Step 24: BSAS Adjustments" backHref="/bsas-trigger" next={null}>
        <form onSubmit={onSubmit} className="space-y-6 max-w-4xl mx-auto">
          {/* Tax Year Input and new Summary Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="font-semibold mb-3 text-lg">Tax Year</p>
            <div className="flex items-end justify-between gap-4">
              <div className="max-w-xs flex-1">
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

              {/* Action Buttons (List Summaries & Trigger Summary) */}
              <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleListSummaries}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <InformationCircleIcon className="h-5 w-5 mr-2" />
                  List Summaries
                  {listSummariesExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                </button>
                <button
                    type="button"
                    onClick={() => setTriggerSummaryExpanded(prev => !prev)}
                    className="inline-flex items-center px-2 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Trigger Summary
                  {triggerSummaryExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible List Summaries Section */}
          {listSummariesExpanded && (
              <div className="mt-2 border border-purple-200 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden shadow-sm">
                <div className="p-6">
                  <h6 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <InformationCircleIcon className="h-5 w-5 mr-2 text-purple-600" />
                    List Adjustable Summaries
                  </h6>
                  {renderSummariesData()}
                </div>
              </div>
          )}

          {/* Collapsible Trigger Summary Section (MODIFIED) */}
          {triggerSummaryExpanded && (
              <div className="mt-2 border border-orange-200 rounded-lg bg-gradient-to-br from-orange-50 to-yellow-50 overflow-hidden shadow-sm">
                <div className="p-6">
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border-2 border-orange-200 p-6">
                    <h6 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                      <ArrowPathIcon className="h-5 w-5 mr-2 text-orange-600" />
                      Trigger Adjustable Summary
                    </h6>

                    {/* FIX: Removed onSubmit={handleTriggerSummary} from the form tag */}
                    <form className="space-y-4">

                      {/* Business Type Selector (Clickable Icons) */}
                      <p className="text-sm font-medium text-gray-700 mb-2">Target Business Type:</p>
                      <div className="flex space-x-4 mb-4">
                        {TRIGGER_BUSINESS_TYPES.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTriggerSummaryInputs(prev => ({ ...prev, businessType: id }))}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-150 w-1/3 text-center ${
                                    triggerSummaryInputs.businessType === id
                                        ? "border-orange-500 bg-orange-100 shadow-lg scale-[1.02]"
                                        : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                                }`}
                            >
                              <Icon className={`h-8 w-8 ${triggerSummaryInputs.businessType === id ? 'text-orange-600' : 'text-gray-500'} mb-2`} />
                              <span className="text-sm font-medium text-gray-800">{label}</span>
                            </button>
                        ))}
                      </div>

                      {/* Business ID Input (Defaulted from app state) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="businessIdInput">
                          Business ID (e.g., XAIS12345678910)
                        </label>
                        <input
                            id="businessIdInput"
                            type="text"
                            value={triggerSummaryInputs.businessId}
                            onChange={(e) => setTriggerSummaryInputs(prev => ({ ...prev, businessId: e.target.value.trim() }))}
                            placeholder="Enter Business ID"
                            className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                            required
                        />
                        {appBusinessId && (
                            <p className="text-xs text-gray-500 mt-1 text-gray-600">Default value loaded from session: <span className="font-mono">{appBusinessId}</span></p>
                        )}
                      </div>

                      {/* Start Date Input (YYYY-MM-DD format) */}
                      <div>
                        <label htmlFor="summaryStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                          Accounting Period Start Date (YYYY-MM-DD)
                        </label>
                        <input
                            id="summaryStartDate"
                            type="date"
                            value={triggerSummaryInputs.startDate}
                            onChange={(e) => setTriggerSummaryInputs(prev => ({ ...prev, startDate: e.target.value }))}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                            required
                        />
                      </div>

                      {/* End Date Input (YYYY-MM-DD format) */}
                      <div>
                        <label htmlFor="summaryEndDate" className="block text-sm font-medium text-gray-700 mb-2">
                          Accounting Period End Date (YYYY-MM-DD)
                        </label>
                        <input
                            id="summaryEndDate"
                            type="date"
                            value={triggerSummaryInputs.endDate}
                            onChange={(e) => setTriggerSummaryInputs(prev => ({ ...prev, endDate: e.target.value }))}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                            required
                        />
                      </div>

                      <div className="mt-6 flex justify-end">
                        {/* FIX: Changed type to "button" and added explicit onClick={handleTriggerSummary} */}
                        <button
                            type="button"
                            onClick={handleTriggerSummary}
                            disabled={triggerSummaryLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                        >
                          {triggerSummaryLoading ? (
                              <>
                                <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" />
                                Triggering...
                              </>
                          ) : (
                              "Trigger Summary Calculation"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
          )}


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

            >
              {loading ? "Submitting..." : "Next"}
            </button>
          </div>
        </form>
      </StepLayout>
  );
}