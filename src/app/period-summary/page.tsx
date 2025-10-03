"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { StepLayout } from "@/components/StepLayout";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

interface PeriodDates {
  periodStartDate: string;
  periodEndDate: string;
}

interface PeriodIncome {
  turnover: number;
  other: number;
  taxTakenOffTradingIncome: number;
}

interface PeriodExpenses {
  costOfGoods: number;
  paymentsToSubcontractors: number;
  wagesAndStaffCosts: number;
  carVanTravelExpenses: number;
  premisesRunningCosts: number;
  maintenanceCosts: number;
  adminCosts: number;
  businessEntertainmentCosts: number;
  advertisingCosts: number;
  interestOnBankOtherLoans: number;
  financeCharges: number;
  irrecoverableDebts: number;
  professionalFees: number;
  depreciation: number;
  otherExpenses: number;
}

interface PeriodDisallowableExpenses {
  costOfGoodsDisallowable: number;
  paymentsToSubcontractorsDisallowable: number;
  wagesAndStaffCostsDisallowable: number;
  carVanTravelExpensesDisallowable: number;
  premisesRunningCostsDisallowable: number;
  maintenanceCostsDisallowable: number;
  adminCostsDisallowable: number;
  businessEntertainmentCostsDisallowable: number;
  advertisingCostsDisallowable: number;
  interestOnBankOtherLoansDisallowable: number;
  financeChargesDisallowable: number;
  irrecoverableDebtsDisallowable: number;
  professionalFeesDisallowable: number;
  depreciationDisallowable: number;
  otherExpensesDisallowable: number;
}

interface FormData {
  periodDates: PeriodDates;
  periodIncome: PeriodIncome;
  periodExpenses: PeriodExpenses;
  periodDisallowableExpenses: PeriodDisallowableExpenses;
}

export default function PeriodSummaryPage() {
  const { nino, businessId, hmrcToken } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    income: false,
    expenses: false,
    disallowableExpenses: false,
  });

  const togglePanel = (panel: string) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

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

  const handleInputChange = (section: keyof FormData, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value === "" ? undefined : parseFloat(value) || 0,
      },
    }));
  };

  const handleDateChange = (field: keyof PeriodDates, value: string) => {
    setFormData(prev => ({
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
    if (typeof data === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== 0 && value !== '') { // Skip 0 and empty strings
          const cleanedValue = cleanSubmissionData(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return Object.keys(cleaned).length ? cleaned : undefined;
    }
    return data;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.periodDates.periodStartDate || !formData.periodDates.periodEndDate) {
      setError("Please fill in all required fields (Start Date and End Date)");
      return;
    }

    setLoading(true);

    try {
      const token = hmrcToken || (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") || "";
      const params = new URLSearchParams({
        nino: nino || "",
        businessId: businessId || "",
        token
      });

      // Clean the data before sending (remove 0 and empty values)
      const cleanedData = cleanSubmissionData(formData);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error("Backend base URL is not configured");
      }
      const headers = getOrGenerateAndPersistFraudHeaders();
      await axios.post(`${baseUrl}/api/external/selfEmploymentPeriod?${params.toString()}`, cleanedData, { headers });
      router.push("/annual-submission");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit period summary");
    } finally {
      setLoading(false);
    }
  };

  const renderInputField = (
    section: keyof FormData,
    field: string,
    label: string,
    placeholder: string = "0.00"
  ) => {
    const sectionData = formData[section] as Record<string, any>;
    const value = sectionData[field];

    return (
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <input
          type="number"
          step="0.01"
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
          value={value === undefined ? '' : value}
          onChange={(e) => handleInputChange(section, field, e.target.value)}
        />
      </div>
    );
  };

  return (
    <StepLayout title="Self-Employment Period Summary" backHref="/obligations" next={null}>
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Period Dates */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Period Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded-md"
                value={formData.periodDates.periodStartDate}
                onChange={(e) => handleDateChange("periodStartDate", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded-md"
                value={formData.periodDates.periodEndDate}
                onChange={(e) => handleDateChange("periodEndDate", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Income Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => togglePanel('income')}
          >
            <h2 className="text-lg font-semibold">Income</h2>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedPanels.income ? 'rotate-180' : ''}`}
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

        {/* Expenses Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => togglePanel('expenses')}
          >
            <h2 className="text-lg font-semibold">Expenses</h2>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedPanels.expenses ? 'rotate-180' : ''}`}
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

        {/* Disallowable Expenses Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => togglePanel('disallowableExpenses')}
          >
            <h2 className="text-lg font-semibold">Disallowable Expenses</h2>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedPanels.disallowableExpenses ? 'rotate-180' : ''}`}
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

        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </StepLayout>
  );
}
