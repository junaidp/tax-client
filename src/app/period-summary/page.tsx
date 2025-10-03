"use client";
import { useState } from "react";
import axios from "axios";
import { StepLayout } from "@/components/StepLayout";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";

interface PeriodDates {
  periodStartDate?: string;
  periodEndDate?: string;
}

interface PeriodIncome {
  turnover?: number;
  other?: number;
  taxTakenOffTradingIncome?: number;
}

interface PeriodExpenses {
  costOfGoods?: number;
  paymentsToSubcontractors?: number;
  wagesAndStaffCosts?: number;
  carVanTravelExpenses?: number;
  premisesRunningCosts?: number;
  maintenanceCosts?: number;
  adminCosts?: number;
  businessEntertainmentCosts?: number;
  advertisingCosts?: number;
  interestOnBankOtherLoans?: number;
  financeCharges?: number;
  irrecoverableDebts?: number;
  professionalFees?: number;
  depreciation?: number;
  otherExpenses?: number;
}

interface PeriodDisallowableExpenses {
  costOfGoodsDisallowable?: number;
  paymentsToSubcontractorsDisallowable?: number;
  wagesAndStaffCostsDisallowable?: number;
  carVanTravelExpensesDisallowable?: number;
  premisesRunningCostsDisallowable?: number;
  maintenanceCostsDisallowable?: number;
  adminCostsDisallowable?: number;
  businessEntertainmentCostsDisallowable?: number;
  advertisingCostsDisallowable?: number;
  interestOnBankOtherLoansDisallowable?: number;
  financeChargesDisallowable?: number;
  irrecoverableDebtsDisallowable?: number;
  professionalFeesDisallowable?: number;
  depreciationDisallowable?: number;
  otherExpensesDisallowable?: number;
}

interface FormData {
  periodDates: PeriodDates;
  periodIncome: PeriodIncome;
  periodExpenses: PeriodExpenses;
  periodDisallowableExpenses: PeriodDisallowableExpenses;
}

type SummaryType = "selfEmployment" | "ukProperty" | "foreignProperty";

export default function PeriodSummaryPage() {
  const { nino, businessId, hmrcToken } = useAppState();
  const router = useRouter();

  const [summaryType, setSummaryType] = useState<SummaryType>("selfEmployment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Self-employment form state (exactly as before)
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    income: false,
    expenses: false,
    disallowableExpenses: false,
  });

  const togglePanel = (panel: string) =>
      setExpandedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));

  const [formData, setFormData] = useState<FormData>({
    periodDates: {
      periodStartDate: sessionStorage.getItem("period_from") || "",
      periodEndDate: sessionStorage.getItem("period_to") || "",
    },
    periodIncome: {
      turnover: 0,
      other: 0,
      taxTakenOffTradingIncome: 0,
    },
    periodExpenses: {
      costOfGoods: 0,
      paymentsToSubcontractors: 0,
      wagesAndStaffCosts: 0,
      carVanTravelExpenses: 0,
      premisesRunningCosts: 0,
      maintenanceCosts: 0,
      adminCosts: 0,
      businessEntertainmentCosts: 0,
      advertisingCosts: 0,
      interestOnBankOtherLoans: 0,
      financeCharges: 0,
      irrecoverableDebts: 0,
      professionalFees: 0,
      depreciation: 0,
      otherExpenses: 0,
    },
    periodDisallowableExpenses: {
      costOfGoodsDisallowable: 0,
      paymentsToSubcontractorsDisallowable: 0,
      wagesAndStaffCostsDisallowable: 0,
      carVanTravelExpensesDisallowable: 0,
      premisesRunningCostsDisallowable: 0,
      maintenanceCostsDisallowable: 0,
      adminCostsDisallowable: 0,
      businessEntertainmentCostsDisallowable: 0,
      advertisingCostsDisallowable: 0,
      interestOnBankOtherLoansDisallowable: 0,
      financeChargesDisallowable: 0,
      irrecoverableDebtsDisallowable: 0,
      professionalFeesDisallowable: 0,
      depreciationDisallowable: 0,
      otherExpensesDisallowable: 0,
    },
  });

  // UK Property state (strings so user can type; we'll parse on submit)
  const [taxYear, setTaxYear] = useState("");
  const [propertyDates, setPropertyDates] = useState({ fromDate: "", toDate: "" });

  const [ukIncome, setUkIncome] = useState({
    premiumsOfLeaseGrant: "",
    reversePremiums: "",
    periodAmount: "",
    taxDeducted: "",
    otherIncome: "",
    // rentARoom omitted complex substructure for now (could be added later)
  });
  const [ukExpenses, setUkExpenses] = useState({
    premisesRunningCosts: "",
    repairsAndMaintenance: "",
    financialCosts: "",
    professionalFees: "",
    costOfServices: "",
    other: "",
    residentialFinancialCost: "",
    travelCosts: "",
    residentialFinancialCostsCarriedForward: "",
    consolidatedExpenses: "",
    // broughtFwdResidentialFinancialCost if needed later
  });

  // Foreign Property: allow multiple entries
  type FPEntry = {
    countryCode: string;
    income: {
      premiumsOfLeaseGrant?: string;
      otherPropertyIncome?: string;
      foreignTaxPaidOrDeducted?: string;
      specialWithholdingTaxOrUkTaxPaid?: string;
      // foreignTaxCreditRelief is boolean
    };
    expenses: {
      premisesRunningCosts?: string;
      repairsAndMaintenance?: string;
      financialCosts?: string;
      professionalFees?: string;
      travelCosts?: string;
      costOfServices?: string;
      other?: string;
      residentialFinancialCost?: string;
      broughtFwdResidentialFinancialCost?: string;
      consolidatedExpenses?: string;
    };
    foreignTaxCreditRelief?: boolean;
  };

  const [foreignProperties, setForeignProperties] = useState<FPEntry[]>([
    {
      countryCode: "FRA",
      income: {},
      expenses: {},
      foreignTaxCreditRelief: false,
    },
  ]);

  // Helpers
  const handleInputChange = (section: keyof FormData, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value === "" ? undefined : parseFloat(value) || 0,
      } as any,
    }));
  };

  const handleDateChange = (field: keyof PeriodDates, value: string) => {
    setFormData((prev) => ({
      ...prev,
      periodDates: {
        ...prev.periodDates,
        [field]: value || undefined,
      },
    }));
  };

  const cleanSubmissionData = (data: any): any => {
    if (data === null || data === undefined) return undefined;
    if (Array.isArray(data)) {
      const cleaned = data.map(cleanSubmissionData).filter(Boolean);
      return cleaned.length ? cleaned : undefined;
    }
    if (typeof data === "object") {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        // previous logic: skip 0 and empty strings
        if (value !== 0 && value !== "") {
          const cleanedValue = cleanSubmissionData(value);
          if (cleanedValue !== undefined) cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length ? cleaned : undefined;
    }
    return data;
  };

  const parseNumberOrUndefined = (v?: string) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // basic validation
    if (summaryType === "selfEmployment") {
      if (!formData.periodDates.periodStartDate || !formData.periodDates.periodEndDate) {
        setError("Please fill in Start Date and End Date for the Self-Employment period.");
        return;
      }
    } else {
      if (!taxYear || !/^\d{4}-\d{2}$/.test(taxYear)) {
        setError("Please provide Tax Year in the format 2024-25.");
        return;
      }
      // property dates optional per HMRC
    }

    setLoading(true);

    try {
      const token = hmrcToken || (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") || "";
      const params = new URLSearchParams({
        nino: nino || "",
        businessId: businessId || "",
        token,
      });

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");

      const headers = getOrGenerateAndPersistFraudHeaders();

      if (summaryType === "selfEmployment") {
        const cleanedData = cleanSubmissionData(formData);
        await axios.post(`${baseUrl}/api/external/selfEmploymentPeriod?${params.toString()}`, cleanedData, { headers });
      } else if (summaryType === "ukProperty") {
        // Build HMRC-compliant UK property body
        const body: any = {
          fromDate: propertyDates.fromDate || undefined,
          toDate: propertyDates.toDate || undefined,
          ukProperty: {
            income: {
              premiumsOfLeaseGrant: parseNumberOrUndefined(ukIncome.premiumsOfLeaseGrant),
              reversePremiums: parseNumberOrUndefined(ukIncome.reversePremiums),
              periodAmount: parseNumberOrUndefined(ukIncome.periodAmount),
              taxDeducted: parseNumberOrUndefined(ukIncome.taxDeducted),
              otherIncome: parseNumberOrUndefined(ukIncome.otherIncome),
            },
            expenses: {
              premisesRunningCosts: parseNumberOrUndefined(ukExpenses.premisesRunningCosts),
              repairsAndMaintenance: parseNumberOrUndefined(ukExpenses.repairsAndMaintenance),
              financialCosts: parseNumberOrUndefined(ukExpenses.financialCosts),
              professionalFees: parseNumberOrUndefined(ukExpenses.professionalFees),
              costOfServices: parseNumberOrUndefined(ukExpenses.costOfServices),
              other: parseNumberOrUndefined(ukExpenses.other),
              residentialFinancialCost: parseNumberOrUndefined(ukExpenses.residentialFinancialCost),
              travelCosts: parseNumberOrUndefined(ukExpenses.travelCosts),
              residentialFinancialCostsCarriedForward: parseNumberOrUndefined(ukExpenses.residentialFinancialCostsCarriedForward),
              consolidatedExpenses: parseNumberOrUndefined(ukExpenses.consolidatedExpenses),
            },
          },
        };

        const cleaned = cleanSubmissionData(body);

        await axios.put(
            `${baseUrl}/api/external/createAndAmendUKPropertyPeriod?${params.toString()}&taxYear=${encodeURIComponent(taxYear)}`,
            cleaned,
            { headers }
        );
      } else {
        // foreignProperty
        const fpBodyArray = foreignProperties.map((fp) => ({
          countryCode: fp.countryCode,
          income: {
            premiumsOfLeaseGrant: parseNumberOrUndefined(fp.income.premiumsOfLeaseGrant),
            otherPropertyIncome: parseNumberOrUndefined(fp.income.otherPropertyIncome),
            foreignTaxPaidOrDeducted: parseNumberOrUndefined(fp.income.foreignTaxPaidOrDeducted),
            specialWithholdingTaxOrUkTaxPaid: parseNumberOrUndefined(fp.income.specialWithholdingTaxOrUkTaxPaid),
            foreignTaxCreditRelief: fp.foreignTaxCreditRelief === true ? true : undefined,
          },
          expenses: {
            premisesRunningCosts: parseNumberOrUndefined(fp.expenses.premisesRunningCosts),
            repairsAndMaintenance: parseNumberOrUndefined(fp.expenses.repairsAndMaintenance),
            financialCosts: parseNumberOrUndefined(fp.expenses.financialCosts),
            professionalFees: parseNumberOrUndefined(fp.expenses.professionalFees),
            travelCosts: parseNumberOrUndefined(fp.expenses.travelCosts),
            costOfServices: parseNumberOrUndefined(fp.expenses.costOfServices),
            other: parseNumberOrUndefined(fp.expenses.other),
            residentialFinancialCost: parseNumberOrUndefined(fp.expenses.residentialFinancialCost),
            broughtFwdResidentialFinancialCost: parseNumberOrUndefined(fp.expenses.broughtFwdResidentialFinancialCost),
            consolidatedExpenses: parseNumberOrUndefined(fp.expenses.consolidatedExpenses),
          },
        }));

        const body = {
          fromDate: propertyDates.fromDate || undefined,
          toDate: propertyDates.toDate || undefined,
          foreignProperty: fpBodyArray,
        };

        const cleaned = cleanSubmissionData(body);

        await axios.put(
            `${baseUrl}/api/external/createAndAmendForeignPropertyPeriod?${params.toString()}&taxYear=${encodeURIComponent(taxYear)}`,
            cleaned,
            { headers }
        );
      }

      router.push("/annual-submission");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit period summary");
    } finally {
      setLoading(false);
    }
  };

  // Re-usable renderer for the original self-employment numeric fields (keeps original behaviour)
  const renderInputField = (
      section: keyof FormData,
      field: string,
      label: string,
      placeholder: string = "0.00"
  ) => {
    const sectionData = formData[section] as Record<string, any>;
    const value = sectionData[field];

    return (
        <div className="mb-2" key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label} <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
              type="number"
              step="0.01"
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={placeholder}
              value={value === undefined ? "" : value}
              onChange={(e) => handleInputChange(section, field, e.target.value)}
          />
        </div>
    );
  };

  // small renderer for single numeric property fields
  const renderNumberField = (label: string, value: string, onChange: (v: string) => void, hint?: string) => (
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {hint ? <span className="text-gray-400 text-xs">({hint})</span> : null}
        </label>
        <input
            type="number"
            step="0.01"
            className="w-full p-2 border rounded-md"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
      </div>
  );

  return (
      <StepLayout title="Period Summary" backHref="/obligations" next={null}>
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
              onClick={() => setSummaryType("selfEmployment")}
              className={`px-4 py-2 rounded-t-lg border-b-2 ${
                  summaryType === "selfEmployment"
                      ? "bg-white border-blue-600 text-blue-600"
                      : "bg-gray-100 border-transparent text-gray-700"
              }`}
          >
            Self-Employment
          </button>
          <button
              onClick={() => setSummaryType("ukProperty")}
              className={`px-4 py-2 rounded-t-lg border-b-2 ${
                  summaryType === "ukProperty"
                      ? "bg-white border-blue-600 text-blue-600"
                      : "bg-gray-100 border-transparent text-gray-700"
              }`}
          >
            UK Property
          </button>
          <button
              onClick={() => setSummaryType("foreignProperty")}
              className={`px-4 py-2 rounded-t-lg border-b-2 ${
                  summaryType === "foreignProperty"
                      ? "bg-white border-blue-600 text-blue-600"
                      : "bg-gray-100 border-transparent text-gray-700"
              }`}
          >
            Foreign Property
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Common dates / tax year */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Period Dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                    type="date"
                    className="w-full p-2 border rounded-md"
                    value={summaryType === "selfEmployment" ? (formData.periodDates.periodStartDate || "") : propertyDates.fromDate}
                    onChange={(e) =>
                        summaryType === "selfEmployment"
                            ? handleDateChange("periodStartDate", e.target.value)
                            : setPropertyDates((p) => ({ ...p, fromDate: e.target.value }))
                    }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                    type="date"
                    className="w-full p-2 border rounded-md"
                    value={summaryType === "selfEmployment" ? (formData.periodDates.periodEndDate || "") : propertyDates.toDate}
                    onChange={(e) =>
                        summaryType === "selfEmployment"
                            ? handleDateChange("periodEndDate", e.target.value)
                            : setPropertyDates((p) => ({ ...p, toDate: e.target.value }))
                    }
                />
              </div>
            </div>

            {summaryType !== "selfEmployment" && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year (e.g. 2024-25)</label>
                  <input
                      type="text"
                      className="w-full p-2 border rounded-md"
                      value={taxYear}
                      onChange={(e) => setTaxYear(e.target.value)}
                      placeholder="2024-25"
                      required
                  />
                </div>
            )}
          </div>

          {/* Self-Employment panels (UNCHANGED structure & fields) */}
          {summaryType === "selfEmployment" && (
              <>
                {/* Income panel */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => togglePanel("income")}>
                    <h2 className="text-lg font-semibold">Income</h2>
                    <svg
                        className={`w-5 h-5 transform transition-transform ${expandedPanels.income ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expandedPanels.income && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderInputField("periodIncome", "turnover", "Turnover")}
                        {renderInputField("periodIncome", "other", "Other Income")}
                        {renderInputField("periodIncome", "taxTakenOffTradingIncome", "Tax Taken Off Trading Income")}
                      </div>
                  )}
                </div>

                {/* Expenses panel */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => togglePanel("expenses")}>
                    <h2 className="text-lg font-semibold">Expenses</h2>
                    <svg
                        className={`w-5 h-5 transform transition-transform ${expandedPanels.expenses ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expandedPanels.expenses && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderInputField("periodExpenses", "costOfGoods", "Cost of Goods")}
                        {renderInputField("periodExpenses", "paymentsToSubcontractors", "Payments to Subcontractors")}
                        {renderInputField("periodExpenses", "wagesAndStaffCosts", "Wages and Staff Costs")}
                        {renderInputField("periodExpenses", "carVanTravelExpenses", "Car/Van Travel Expenses")}
                        {renderInputField("periodExpenses", "premisesRunningCosts", "Premises Running Costs")}
                        {renderInputField("periodExpenses", "maintenanceCosts", "Maintenance Costs")}
                        {renderInputField("periodExpenses", "adminCosts", "Admin Costs")}
                        {renderInputField("periodExpenses", "businessEntertainmentCosts", "Business Entertainment Costs")}
                        {renderInputField("periodExpenses", "advertisingCosts", "Advertising Costs")}
                        {renderInputField("periodExpenses", "interestOnBankOtherLoans", "Interest on Bank/Loans")}
                        {renderInputField("periodExpenses", "financeCharges", "Finance Charges")}
                        {renderInputField("periodExpenses", "irrecoverableDebts", "Irrecoverable Debts")}
                        {renderInputField("periodExpenses", "professionalFees", "Professional Fees")}
                        {renderInputField("periodExpenses", "depreciation", "Depreciation")}
                        {renderInputField("periodExpenses", "otherExpenses", "Other Expenses")}
                      </div>
                  )}
                </div>

                {/* Disallowable Expenses panel */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => togglePanel("disallowableExpenses")}>
                    <h2 className="text-lg font-semibold">Disallowable Expenses</h2>
                    <svg
                        className={`w-5 h-5 transform transition-transform ${expandedPanels.disallowableExpenses ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expandedPanels.disallowableExpenses && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderInputField("periodDisallowableExpenses", "costOfGoodsDisallowable", "Cost of Goods (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "paymentsToSubcontractorsDisallowable", "Payments to Subcontractors (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "wagesAndStaffCostsDisallowable", "Wages and Staff Costs (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "carVanTravelExpensesDisallowable", "Car/Van Travel Expenses (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "premisesRunningCostsDisallowable", "Premises Running Costs (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "maintenanceCostsDisallowable", "Maintenance Costs (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "adminCostsDisallowable", "Admin Costs (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "businessEntertainmentCostsDisallowable", "Business Entertainment (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "advertisingCostsDisallowable", "Advertising Costs (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "interestOnBankOtherLoansDisallowable", "Interest on Bank/Loans (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "financeChargesDisallowable", "Finance Charges (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "irrecoverableDebtsDisallowable", "Irrecoverable Debts (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "professionalFeesDisallowable", "Professional Fees (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "depreciationDisallowable", "Depreciation (Disallowable)")}
                        {renderInputField("periodDisallowableExpenses", "otherExpensesDisallowable", "Other Expenses (Disallowable)")}
                      </div>
                  )}
                </div>
              </>
          )}

          {/* UK Property UI */}
          {summaryType === "ukProperty" && (
              <>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-lg font-semibold mb-4">UK Property - Income</h2>
                  {renderNumberField("Premiums Of Lease Grant", ukIncome.premiumsOfLeaseGrant, (v) => setUkIncome((s) => ({ ...s, premiumsOfLeaseGrant: v })), "£") }
                  {renderNumberField("Reverse Premiums", ukIncome.reversePremiums, (v) => setUkIncome((s) => ({ ...s, reversePremiums: v })), "£") }
                  {renderNumberField("Period Amount (Total rents)", ukIncome.periodAmount, (v) => setUkIncome((s) => ({ ...s, periodAmount: v })), "£") }
                  {renderNumberField("Tax Deducted", ukIncome.taxDeducted, (v) => setUkIncome((s) => ({ ...s, taxDeducted: v })), "£") }
                  {renderNumberField("Other Income", ukIncome.otherIncome, (v) => setUkIncome((s) => ({ ...s, otherIncome: v })), "£") }
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-lg font-semibold mb-4">UK Property - Expenses</h2>
                  {renderNumberField("Premises Running Costs", ukExpenses.premisesRunningCosts, (v) => setUkExpenses((s) => ({ ...s, premisesRunningCosts: v })), "£")}
                  {renderNumberField("Repairs & Maintenance", ukExpenses.repairsAndMaintenance, (v) => setUkExpenses((s) => ({ ...s, repairsAndMaintenance: v })), "£")}
                  {renderNumberField("Financial Costs", ukExpenses.financialCosts, (v) => setUkExpenses((s) => ({ ...s, financialCosts: v })), "£")}
                  {renderNumberField("Professional Fees", ukExpenses.professionalFees, (v) => setUkExpenses((s) => ({ ...s, professionalFees: v })), "£")}
                  {renderNumberField("Cost Of Services", ukExpenses.costOfServices, (v) => setUkExpenses((s) => ({ ...s, costOfServices: v })), "£")}
                  {renderNumberField("Other Expenses", ukExpenses.other, (v) => setUkExpenses((s) => ({ ...s, other: v })), "£")}
                  {renderNumberField("Residential Financial Cost", ukExpenses.residentialFinancialCost, (v) => setUkExpenses((s) => ({ ...s, residentialFinancialCost: v })), "£")}
                  {renderNumberField("Travel Costs", ukExpenses.travelCosts, (v) => setUkExpenses((s) => ({ ...s, travelCosts: v })), "£")}
                  {renderNumberField("Residential Financial Costs Carried Forward", ukExpenses.residentialFinancialCostsCarriedForward, (v) => setUkExpenses((s) => ({ ...s, residentialFinancialCostsCarriedForward: v })), "£")}
                  {renderNumberField("Consolidated Expenses", ukExpenses.consolidatedExpenses, (v) => setUkExpenses((s) => ({ ...s, consolidatedExpenses: v })), "£")}
                </div>
              </>
          )}

          {/* Foreign Property UI */}
          {summaryType === "foreignProperty" && (
              <>
                {foreignProperties.map((entry, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-lg shadow-md">
                      <h2 className="text-lg font-semibold mb-4">Foreign Property #{idx + 1}</h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country Code (ISO 3166-1 alpha-3)</label>
                          <input
                              type="text"
                              className="w-full p-2 border rounded-md"
                              value={entry.countryCode || ""}
                              onChange={(e) => {
                                const copy = [...foreignProperties];
                                copy[idx].countryCode = e.target.value.toUpperCase();
                                setForeignProperties(copy);
                              }}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                              id={`ftcr-${idx}`}
                              type="checkbox"
                              checked={!!entry.foreignTaxCreditRelief}
                              onChange={(e) => {
                                const copy = [...foreignProperties];
                                copy[idx].foreignTaxCreditRelief = e.target.checked;
                                setForeignProperties(copy);
                              }}
                          />
                          <label htmlFor={`ftcr-${idx}`} className="text-sm">Foreign Tax Credit Relief</label>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h3 className="font-semibold">Income</h3>
                        {renderNumberField("Premiums Of Lease Grant", entry.income.premiumsOfLeaseGrant || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].income.premiumsOfLeaseGrant = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Other Property Income", entry.income.otherPropertyIncome || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].income.otherPropertyIncome = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Foreign Tax Paid Or Deducted", entry.income.foreignTaxPaidOrDeducted || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].income.foreignTaxPaidOrDeducted = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Special Withholding Tax Or UK Tax Paid", entry.income.specialWithholdingTaxOrUkTaxPaid || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].income.specialWithholdingTaxOrUkTaxPaid = v;
                          setForeignProperties(copy);
                        })}
                      </div>

                      <div className="mt-4">
                        <h3 className="font-semibold">Expenses</h3>
                        {renderNumberField("Premises Running Costs", entry.expenses.premisesRunningCosts || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.premisesRunningCosts = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Repairs & Maintenance", entry.expenses.repairsAndMaintenance || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.repairsAndMaintenance = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Financial Costs", entry.expenses.financialCosts || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.financialCosts = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Professional Fees", entry.expenses.professionalFees || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.professionalFees = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Travel Costs", entry.expenses.travelCosts || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.travelCosts = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Cost Of Services", entry.expenses.costOfServices || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.costOfServices = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Other Expenses", entry.expenses.other || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.other = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Residential Financial Cost", entry.expenses.residentialFinancialCost || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.residentialFinancialCost = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Brought Forward Residential Financial Cost", entry.expenses.broughtFwdResidentialFinancialCost || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.broughtFwdResidentialFinancialCost = v;
                          setForeignProperties(copy);
                        })}
                        {renderNumberField("Consolidated Expenses", entry.expenses.consolidatedExpenses || "", (v) => {
                          const copy = [...foreignProperties];
                          copy[idx].expenses.consolidatedExpenses = v;
                          setForeignProperties(copy);
                        })}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            className="px-3 py-1 bg-gray-200 rounded"
                            onClick={() => {
                              const copy = [...foreignProperties];
                              copy.splice(idx, 1);
                              setForeignProperties(copy.length ? copy : [{ countryCode: "", income: {}, expenses: {}, foreignTaxCreditRelief: false }]);
                            }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                ))}

                <div>
                  <button
                      type="button"
                      onClick={() =>
                          setForeignProperties((prev) => [
                            ...prev,
                            { countryCode: "", income: {}, expenses: {}, foreignTaxCreditRelief: false },
                          ])
                      }
                      className="px-4 py-2 bg-gray-200 rounded-md"
                  >
                    + Add Another Foreign Property Entry
                  </button>
                </div>
              </>
          )}

          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

          <div className="flex justify-end mt-6">
            <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </StepLayout>
  );
}
