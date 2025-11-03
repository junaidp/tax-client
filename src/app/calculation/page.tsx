"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";
import { useRouter } from "next/navigation";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const SectionCard = ({ title, description, children }: SectionCardProps) => (
    <div className="border rounded shadow p-4 bg-white space-y-3">
      <div>
        <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
        {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
);

type KeyValueItem = {
  label: string;
  value?: ReactNode;
};

const KeyValueGrid = ({ items }: { items: KeyValueItem[] }) => (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {items.map((item) => (
          <div key={item.label} className="flex flex-col">
            <dt className="text-gray-500">{item.label}</dt>
            <dd className="font-medium text-gray-900 break-words">
              {item.value ?? "—"}
            </dd>
          </div>
      ))}
    </dl>
);

export default function CalculationPage() {
  const { nino, taxYear } = useAppState();
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || "");
  const [calculationId, setCalculationId] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const router = useRouter();

  // Load values from sessionStorage
  useEffect(() => {
    setCalculationId(sessionStorage.getItem("calculationId") || "");
    setLocalTaxYear((s) => s || sessionStorage.getItem("taxYear") || "");
  }, []);

  // Persist to sessionStorage
  useEffect(() => {
    if (localTaxYear) sessionStorage.setItem("taxYear", localTaxYear);
  }, [localTaxYear]);

  useEffect(() => {
    if (calculationId) sessionStorage.setItem("calculationId", calculationId);
  }, [calculationId]);

  const retrieve = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("hmrcToken") || "";
      const params = new URLSearchParams({
        nino: nino || "",
        taxYear: localTaxYear,
        calculationId,
        token,
      });
      const headers = getOrGenerateAndPersistFraudHeaders();
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) throw new Error("Backend base URL is not configured");

      const response = await axios.get(
        `${baseUrl}/api/external/calculations?${params.toString()}`,
        { headers }
      );
      setResult(response.data);
    } catch (e: any) {
      const apiError =
          e.response?.data?.message || e.message || "Failed to retrieve calculation";
      setError(apiError);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch
  useEffect(() => {
    if (nino && localTaxYear && calculationId) retrieve();
  }, [nino, localTaxYear, calculationId]);

  const onNext = () => router.push("/final-declaration");

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBoolean = (value?: boolean | null) => {
    if (value === null || value === undefined) return "—";
    return value ? "Yes" : "No";
  };

  return (
      <StepLayout
          title="Step 38: Calculation Result"
          backHref="/final-calc-trigger"
          next={
            <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={onNext}
                disabled={!result}
            >
              Next
            </button>
          }
      >
        <div className="space-y-6">
          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="nino">
                NINO
              </label>
              <input
                  id="nino"
                  className="w-full p-2 border rounded"
                  value={nino || ""}
                  readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="taxYear">
                Tax year
              </label>
              <input
                  id="taxYear"
                  className="w-full p-2 border rounded"
                  value={localTaxYear}
                  onChange={(e) => setLocalTaxYear(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="calcId">
                Calculation ID
              </label>
              <input
                  id="calcId"
                  className="w-full p-2 border rounded"
                  value={calculationId}
                  onChange={(e) => setCalculationId(e.target.value)}
              />
            </div>
          </div>

          {/* Refresh button */}
          <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={retrieve}
              disabled={loading || !nino || !localTaxYear || !calculationId}
          >
            {loading ? "Loading..." : "Refresh Calculation"}
          </button>

          {error && <p className="text-red-500">{error}</p>}

          {result && (
              <div className="space-y-6">
                <SectionCard title="Calculation Metadata">
                  <KeyValueGrid
                      items={[
                        { label: "Calculation ID", value: result?.metadata?.calculationId },
                        { label: "Tax Year", value: result?.metadata?.taxYear },
                        { label: "Calculation Type", value: result?.metadata?.calculationType },
                        { label: "Requested By", value: result?.metadata?.requestedBy },
                        { label: "Requested", value: formatDateTime(result?.metadata?.requestedTimestamp) },
                        { label: "Calculated", value: formatDateTime(result?.metadata?.calculationTimestamp) },
                        { label: "Final Declaration", value: formatBoolean(result?.metadata?.finalDeclaration) },
                        { label: "Period", value: result?.metadata?.periodFrom && result?.metadata?.periodTo
                            ? `${result.metadata.periodFrom} → ${result.metadata.periodTo}`
                            : "—" },
                      ]}
                  />
                </SectionCard>

                {result?.inputs?.personalInformation && (
                    <SectionCard title="Personal Information" description="Key taxpayer details used for this calculation.">
                      <KeyValueGrid
                          items={[
                            { label: "Identifier", value: result.inputs.personalInformation.identifier },
                            { label: "Date of Birth", value: result.inputs.personalInformation.dateOfBirth },
                            { label: "Tax Regime", value: result.inputs.personalInformation.taxRegime },
                            { label: "Student Loan Plan", value: result.inputs.personalInformation.studentLoanPlan?.map((p: any) => p.planType).join(", ") || "—" },
                            { label: "Marriage Allowance", value: result.inputs.personalInformation.marriageAllowance },
                            { label: "UTR", value: result.inputs.personalInformation.uniqueTaxpayerReference },
                            { label: "ITSA Status", value: result.inputs.personalInformation.itsaStatus },
                            { label: "Class 2 Voluntary", value: formatBoolean(result.inputs.personalInformation.class2VoluntaryContributions) },
                          ]}
                      />
                    </SectionCard>
                )}

                {result?.calculation?.incomeSummaryTotals && (
                    <SectionCard title="Income Summary Totals">
                      <KeyValueGrid
                          items={[
                            { label: "Self Employment Profit", value: formatNumber(result.calculation.incomeSummaryTotals.totalSelfEmploymentProfit) },
                            { label: "UK Property Profit", value: formatNumber(result.calculation.incomeSummaryTotals.totalUKOtherPropertyProfit) },
                            { label: "Foreign Property Profit", value: formatNumber(result.calculation.incomeSummaryTotals.totalForeignPropertyProfit) },
                            { label: "Employment Income", value: formatNumber(result.calculation.incomeSummaryTotals.totalEmploymentIncome) },
                            { label: "FHL Property Profit", value: formatNumber(result.calculation.incomeSummaryTotals.totalFHLPropertyProfit) },
                            { label: "Eea FHL Profit", value: formatNumber(result.calculation.incomeSummaryTotals.totalEeaFhlProfit) },
                          ]}
                      />
                    </SectionCard>
                )}

                {result?.calculation?.taxCalculation?.incomeTax && (
                    <SectionCard title="Income Tax Overview">
                      <KeyValueGrid
                          items={[
                            { label: "Total Income Received", value: formatNumber(result.calculation.taxCalculation.incomeTax.totalIncomeReceivedFromAllSources) },
                            { label: "Total Allowances & Deductions", value: formatNumber(result.calculation.taxCalculation.incomeTax.totalAllowancesAndDeductions) },
                            { label: "Total Taxable Income", value: formatNumber(result.calculation.taxCalculation.incomeTax.totalTaxableIncome) },
                            { label: "Income Tax Due After Reliefs", value: formatNumber(result.calculation.taxCalculation.incomeTax.incomeTaxDueAfterReliefs) },
                            { label: "Total Income Tax Due", value: formatNumber(result.calculation.taxCalculation.incomeTax.totalIncomeTaxDue) },
                            { label: "Total Tax Reductions", value: formatNumber(result.calculation.taxCalculation.incomeTax.totalReliefs) },
                          ]}
                      />
                    </SectionCard>
                )}

                {(result?.calculation?.taxCalculation?.nics || result?.calculation?.taxCalculation?.capitalGainsTax) && (
                    <SectionCard title="NICs & Capital Gains">
                      <KeyValueGrid
                          items={[
                            { label: "Class 2 NICs Amount", value: formatNumber(result?.calculation?.taxCalculation?.nics?.class2Nics?.amount) },
                            { label: "Class 4 NICs Total", value: formatNumber(result?.calculation?.taxCalculation?.nics?.class4Nics?.totalAmount) },
                            { label: "Total NICs", value: formatNumber(result?.calculation?.taxCalculation?.nics?.totalNic) },
                            { label: "Capital Gains Tax Due", value: formatNumber(result?.calculation?.taxCalculation?.capitalGainsTax?.capitalGainsTaxDue) },
                            { label: "Capital Gains Overpaid", value: formatNumber(result?.calculation?.taxCalculation?.capitalGainsTax?.capitalGainsOverpaid) },
                            { label: "Total Tax & NICs Due", value: formatNumber(result?.calculation?.taxCalculation?.incomeTax?.totalIncomeTaxAndNicsDue || result?.calculation?.taxCalculation?.totalIncomeTaxAndNicsDue) },
                          ]}
                      />
                    </SectionCard>
                )}

                {(result?.calculation?.messages?.info?.length || result?.calculation?.messages?.warnings?.length || result?.calculation?.messages?.errors?.length) && (
                    <SectionCard title="HMRC Messages" description="Additional information returned by HMRC for this calculation.">
                      <div className="space-y-4">
                        {result.calculation.messages.info?.length ? (
                            <div>
                              <h4 className="font-medium text-sm text-green-600">Information</h4>
                              <ul className="mt-1 space-y-1 text-sm">
                                {result.calculation.messages.info.map((msg: any) => (
                                    <li key={`info-${msg.id}`} className="border border-green-100 rounded px-3 py-2 bg-green-50">
                                      <span className="font-semibold">{msg.id}:</span> {msg.text}
                                    </li>
                                ))}
                              </ul>
                            </div>
                        ) : null}
                        {result.calculation.messages.warnings?.length ? (
                            <div>
                              <h4 className="font-medium text-sm text-amber-600">Warnings</h4>
                              <ul className="mt-1 space-y-1 text-sm">
                                {result.calculation.messages.warnings.map((msg: any) => (
                                    <li key={`warn-${msg.id}`} className="border border-amber-100 rounded px-3 py-2 bg-amber-50">
                                      <span className="font-semibold">{msg.id}:</span> {msg.text}
                                    </li>
                                ))}
                              </ul>
                            </div>
                        ) : null}
                        {result.calculation.messages.errors?.length ? (
                            <div>
                              <h4 className="font-medium text-sm text-red-600">Errors</h4>
                              <ul className="mt-1 space-y-1 text-sm">
                                {result.calculation.messages.errors.map((msg: any) => (
                                    <li key={`err-${msg.id}`} className="border border-red-100 rounded px-3 py-2 bg-red-50">
                                      <span className="font-semibold">{msg.id}:</span> {msg.text}
                                    </li>
                                ))}
                              </ul>
                            </div>
                        ) : null}
                      </div>
                    </SectionCard>
                )}

                <div className="border rounded shadow p-4 bg-white">
                  <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => setShowRawJson((prev) => !prev)}
                  >
                    {showRawJson ? "Hide raw response" : "Show raw response"}
                  </button>
                  {showRawJson && (
                      <div className="mt-3 text-xs max-h-[500px] overflow-auto">
                        <JsonView data={result} />
                      </div>
                  )}
                </div>
              </div>
          )}
        </div>
      </StepLayout>
  );
}
