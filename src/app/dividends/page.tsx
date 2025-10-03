"use client";
import { useState } from "react";
import axios from "axios";
import { StepLayout } from "@/components/StepLayout";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

interface ForeignDividend {
  countryCode: string;
  amountBeforeTax?: number;
  taxTakenOff?: number;
  specialWithholdingTax?: number;
  foreignTaxCreditRelief?: boolean;
  taxableAmount: number;
}

interface DividendIncomeWhilstAbroad {
  countryCode: string;
  amountBeforeTax?: number;
  taxTakenOff?: number;
  specialWithholdingTax?: number;
  foreignTaxCreditRelief?: boolean;
  taxableAmount: number;
}

interface SimpleDividend {
  customerReference?: string;
  grossAmount: number;
}

interface FormData {
  foreignDividend: ForeignDividend[];
  dividendIncomeReceivedWhilstAbroad: DividendIncomeWhilstAbroad[];
  stockDividend?: SimpleDividend;
  redeemableShares?: SimpleDividend;
  bonusIssuesOfSecurities?: SimpleDividend;
  closeCompanyLoansWrittenOff?: SimpleDividend;
}

export default function DividendsPage() {
  const { nino, hmrcToken } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    foreignDividend: false,
    dividendIncomeReceivedWhilstAbroad: false,
    stockDividend: false,
    redeemableShares: false,
    bonusIssuesOfSecurities: false,
    closeCompanyLoansWrittenOff: false,
  });

  const togglePanel = (panel: string) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  const [taxYear, setTaxYear] = useState<string>(
      (new Date().getFullYear() - 1).toString()
  );
  const [formData, setFormData] = useState<FormData>({
    foreignDividend: [{ countryCode: "", taxableAmount: 0 }],
    dividendIncomeReceivedWhilstAbroad: [{ countryCode: "", taxableAmount: 0 }],
  });

  const handleArrayChange = (
      section: keyof FormData,
      index: number,
      field: string,
      value: string | boolean
  ) => {
    setFormData((prev) => {
      const arr = [...(prev[section] as any[])];
      arr[index] = {
        ...arr[index],
        [field]:
            typeof value === "string" && value !== ""
                ? parseFloat(value) || value
                : value,
      };
      return { ...prev, [section]: arr };
    });
  };

  const handleObjectChange = (
      section: keyof FormData,
      field: string,
      value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value === "" ? undefined : parseFloat(value) || value,
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
        if (value !== undefined && value !== "") {
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
    setLoading(true);

    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined"
              ? sessionStorage.getItem("hmrcToken")
              : "") ||
          "";

      const params = new URLSearchParams({
        nino: nino || "",
        taxYear: taxYear,
        token,
      });

      const cleanedData = cleanSubmissionData(formData);
      const headers = getOrGenerateAndPersistFraudHeaders();
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error("Backend base URL is not configured");
      }
      await axios.put(
          `${baseUrl}/api/external/dividends?${params.toString()}`,
          cleanedData,
          { headers }
      );

      router.push("/final-calc-trigger");
    } catch (e: any) {
      setError(
          e?.response?.data?.message ||
          e?.message ||
          "Failed to submit dividend data"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderInputField = (
      section: keyof FormData,
      field: string,
      label: string,
      index?: number,
      type: "text" | "number" = "number"
  ) => {
    const sectionData = formData[section] as any;
    const value =
        index !== undefined ? sectionData?.[index]?.[field] : sectionData?.[field];

    const isRequired =
        field === "taxableAmount" || field === "grossAmount" || field === "countryCode";

    return (
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}{" "}
            {isRequired ? (
                <span className="text-red-500 text-xs">(required)</span>
            ) : (
                <span className="text-gray-400 text-xs">(optional)</span>
            )}
          </label>
          <input
              type={type}
              step={type === "number" ? "0.01" : undefined}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={value === undefined ? "" : value}
              onChange={(e) =>
                  index !== undefined
                      ? handleArrayChange(section, index, field, e.target.value)
                      : handleObjectChange(section, field, e.target.value)
              }
              required={isRequired}
              placeholder={field === "countryCode" ? "e.g., GBR" : ""}
              pattern={field === "countryCode" ? "[A-Z]{3}" : undefined}
              title={
                field === "countryCode"
                    ? "Enter a valid 3-letter ISO country code (e.g., GBR)"
                    : ""
              }
          />
        </div>
    );
  };

  return (
      <StepLayout title="Dividends" backHref="/obligations" next={null}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Tax Year Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Year <span className="text-red-500 text-xs">(required)</span>
            </label>
            <input
                type="text"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                required
                placeholder="e.g., 2023-24"
            />
          </div>

          {/* Foreign Dividend */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => togglePanel("foreignDividend")}
            >
              <h2 className="text-lg font-semibold">Foreign Dividend</h2>
              <span>{expandedPanels.foreignDividend ? "▲" : "▼"}</span>
            </div>
            {expandedPanels.foreignDividend &&
                formData.foreignDividend.map((_, idx) => (
                    <div
                        key={idx}
                        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {renderInputField("foreignDividend", "countryCode", "Country Code", idx, "text")}
                      {renderInputField("foreignDividend", "amountBeforeTax", "Amount Before Tax", idx)}
                      {renderInputField("foreignDividend", "taxTakenOff", "Tax Taken Off", idx)}
                      {renderInputField("foreignDividend", "specialWithholdingTax", "Special Withholding Tax", idx)}
                      {renderInputField("foreignDividend", "taxableAmount", "Taxable Amount", idx)}
                    </div>
                ))}
          </div>

          {/* Dividend Income Whilst Abroad */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => togglePanel("dividendIncomeReceivedWhilstAbroad")}
            >
              <h2 className="text-lg font-semibold">Dividend Income Whilst Abroad</h2>
              <span>{expandedPanels.dividendIncomeReceivedWhilstAbroad ? "▲" : "▼"}</span>
            </div>
            {expandedPanels.dividendIncomeReceivedWhilstAbroad &&
                formData.dividendIncomeReceivedWhilstAbroad.map((_, idx) => (
                    <div
                        key={idx}
                        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {renderInputField("dividendIncomeReceivedWhilstAbroad", "countryCode", "Country Code", idx, "text")}
                      {renderInputField("dividendIncomeReceivedWhilstAbroad", "amountBeforeTax", "Amount Before Tax", idx)}
                      {renderInputField("dividendIncomeReceivedWhilstAbroad", "taxTakenOff", "Tax Taken Off", idx)}
                      {renderInputField("dividendIncomeReceivedWhilstAbroad", "specialWithholdingTax", "Special Withholding Tax", idx)}
                      {renderInputField("dividendIncomeReceivedWhilstAbroad", "taxableAmount", "Taxable Amount", idx)}
                    </div>
                ))}
          </div>

          {/* Simple Object Dividends */}
          {[
            { key: "stockDividend", label: "Stock Dividend" },
            { key: "redeemableShares", label: "Redeemable Shares" },
            { key: "bonusIssuesOfSecurities", label: "Bonus Issues of Securities" },
            { key: "closeCompanyLoansWrittenOff", label: "Close Company Loans Written Off" },
          ].map(({ key, label }) => (
              <div key={key} className="bg-white p-6 rounded-lg shadow-md">
                <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => togglePanel(key)}
                >
                  <h2 className="text-lg font-semibold">{label}</h2>
                  <span>{expandedPanels[key] ? "▲" : "▼"}</span>
                </div>
                {expandedPanels[key] && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderInputField(key as keyof FormData, "customerReference", "Customer Reference", undefined, "text")}
                      {renderInputField(key as keyof FormData, "grossAmount", "Gross Amount")}
                    </div>
                )}
              </div>
          ))}

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
