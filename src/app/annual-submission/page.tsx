"use client";
import { useState, useEffect } from "react";
import { StepLayout } from "@/components/StepLayout";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import axios from "axios";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

const TAX_YEAR_TABS = [
  { id: "TY-2023-24", label: "TY 2023-24 and before" },
  { id: "TY-2024-25", label: "TY 2024-25" },
  { id: "TY-2025-26", label: "TY 2025-26 or later" },
];

export default function AnnualSubmissionPage() {
  const { nino, businessId, taxYear, setTaxYear, hmrcToken } = useAppState();
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || TAX_YEAR_TABS[0].id);

  // adjustments
  const [includedNonTaxableProfits, setIncludedNonTaxableProfits] = useState("");
  const [basisAdjustment, setBasisAdjustment] = useState("");
  const [overlapReliefUsed, setOverlapReliefUsed] = useState("");
  const [accountingAdjustment, setAccountingAdjustment] = useState("");
  const [averagingAdjustment, setAveragingAdjustment] = useState("");
  const [outstandingBusinessIncome, setOutstandingBusinessIncome] = useState("");
  const [balancingChargeBpra, setBalancingChargeBpra] = useState("");
  const [balancingChargeOther, setBalancingChargeOther] = useState("");
  const [goodsAndServicesOwnUse, setGoodsAndServicesOwnUse] = useState("");

  // allowances
  const [annualInvestmentAllowance, setAnnualInvestmentAllowance] = useState("");
  const [capitalAllowanceMainPool, setCapitalAllowanceMainPool] = useState("");
  const [capitalAllowanceSpecialRatePool, setCapitalAllowanceSpecialRatePool] = useState("");
  const [zeroEmissionsGoodsVehicleAllowance, setZeroEmissionsGoodsVehicleAllowance] = useState("");
  const [businessPremisesRenovationAllowance, setBusinessPremisesRenovationAllowance] = useState("");
  const [enhancedCapitalAllowance, setEnhancedCapitalAllowance] = useState("");
  const [allowanceOnSales, setAllowanceOnSales] = useState("");
  const [capitalAllowanceSingleAssetPool, setCapitalAllowanceSingleAssetPool] = useState("");
  const [electricChargePointAllowance, setElectricChargePointAllowance] = useState("");
  const [zeroEmissionsCarAllowance, setZeroEmissionsCarAllowance] = useState("");
  const [tradingIncomeAllowance, setTradingIncomeAllowance] = useState("");

  // nonFinancials
  const [businessDetailsChangedRecently, setBusinessDetailsChangedRecently] = useState(false);
  const [class4NicsExemptionReason, setClass4NicsExemptionReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!localTaxYear) {
      const ty = sessionStorage.getItem("taxYear") || TAX_YEAR_TABS[0].id;
      setLocalTaxYear(ty);
    }
  }, []);

  const buildSection = (entries: Record<string, string>) => {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (value && Number(value) !== 0) {
        result[key] = Number(value);
      }
    }
    return result;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") ||
          "";
      // Remove 'TY-' prefix from tax year for the API request
      const cleanTaxYear = localTaxYear.startsWith('TY-') ? localTaxYear.substring(3) : localTaxYear;
      
      const params = new URLSearchParams({
        nino: nino || "",
        businessId: businessId || "",
        taxYear: cleanTaxYear,
        token,
      });

      const body: any = {
        nonFinancials: {
          businessDetailsChangedRecently,
          ...(class4NicsExemptionReason
              ? { class4NicsExemptionReason }
              : {}),
        },
      };

      const adjustments = buildSection({
        includedNonTaxableProfits,
        basisAdjustment,
        overlapReliefUsed,
        accountingAdjustment,
        averagingAdjustment,
        outstandingBusinessIncome,
        balancingChargeBpra,
        balancingChargeOther,
        goodsAndServicesOwnUse,
      });

      const allowances = buildSection({
        annualInvestmentAllowance,
        capitalAllowanceMainPool,
        capitalAllowanceSpecialRatePool,
        zeroEmissionsGoodsVehicleAllowance,
        businessPremisesRenovationAllowance,
        enhancedCapitalAllowance,
        allowanceOnSales,
        capitalAllowanceSingleAssetPool,
        electricChargePointAllowance,
        zeroEmissionsCarAllowance,
        tradingIncomeAllowance,
      });

      if (Object.keys(adjustments).length > 0) {
        body.adjustments = adjustments;
      }
      if (Object.keys(allowances).length > 0) {
        body.allowances = allowances;
      }

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error("Backend base URL is not configured");
      }
      const headers = getOrGenerateAndPersistFraudHeaders();
      await axios.put(
          `${baseUrl}/api/external/selfEmploymentAnnual?${params.toString()}`,
          body,
          { 
            headers
          }
      );

      setTaxYear(cleanTaxYear);
      router.push("/bsas-trigger");
    } catch (e: any) {
      setError(e?.message || "Failed to submit annual submission");
    } finally {
      setLoading(false);
    }
  };

  return (
      <StepLayout title="Step 16: Annual Submission" backHref="/period-summary" next={null}>
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
          {/* Tax Year Tabs */}
          <div>
            <p className="font-medium mb-2">Select Tax Year</p>
            <div className="flex gap-3">
              {TAX_YEAR_TABS.map((tab) => (
                  <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLocalTaxYear(tab.id)}
                      className={`px-4 py-2 rounded border ${
                          localTaxYear === tab.id
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-800"
                      }`}
                  >
                    {tab.label}
                  </button>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <details className="border rounded p-4">
            <summary className="cursor-pointer font-semibold">Adjustments</summary>
            <div className="mt-3 space-y-3">
              {([
                ["includedNonTaxableProfits", includedNonTaxableProfits, setIncludedNonTaxableProfits],
                ["basisAdjustment", basisAdjustment, setBasisAdjustment],
                ["overlapReliefUsed", overlapReliefUsed, setOverlapReliefUsed],
                ["accountingAdjustment", accountingAdjustment, setAccountingAdjustment],
                ["averagingAdjustment", averagingAdjustment, setAveragingAdjustment],
                ["outstandingBusinessIncome", outstandingBusinessIncome, setOutstandingBusinessIncome],
                ["balancingChargeBpra", balancingChargeBpra, setBalancingChargeBpra],
                ["balancingChargeOther", balancingChargeOther, setBalancingChargeOther],
                ["goodsAndServicesOwnUse", goodsAndServicesOwnUse, setGoodsAndServicesOwnUse],
              ] as [string, string, React.Dispatch<React.SetStateAction<string>>][])
                  .map(([id, val, setter]) => (
                      <div key={id}>
                        <label className="label" htmlFor={id}>
                          {id}
                        </label>
                        <input
                            id={id}
                            type="number"
                            step="0.01"
                            className="input"
                            value={val}
                            onChange={(e) => setter(e.target.value)}
                        />
                      </div>
                  ))}
            </div>
          </details>

          {/* Allowances */}
          <details className="border rounded p-4">
            <summary className="cursor-pointer font-semibold">Allowances</summary>
            <div className="mt-3 space-y-3">
              {([
                ["annualInvestmentAllowance", annualInvestmentAllowance, setAnnualInvestmentAllowance],
                ["capitalAllowanceMainPool", capitalAllowanceMainPool, setCapitalAllowanceMainPool],
                ["capitalAllowanceSpecialRatePool", capitalAllowanceSpecialRatePool, setCapitalAllowanceSpecialRatePool],
                ["zeroEmissionsGoodsVehicleAllowance", zeroEmissionsGoodsVehicleAllowance, setZeroEmissionsGoodsVehicleAllowance],
                ["businessPremisesRenovationAllowance", businessPremisesRenovationAllowance, setBusinessPremisesRenovationAllowance],
                ["enhancedCapitalAllowance", enhancedCapitalAllowance, setEnhancedCapitalAllowance],
                ["allowanceOnSales", allowanceOnSales, setAllowanceOnSales],
                ["capitalAllowanceSingleAssetPool", capitalAllowanceSingleAssetPool, setCapitalAllowanceSingleAssetPool],
                ["electricChargePointAllowance", electricChargePointAllowance, setElectricChargePointAllowance],
                ["zeroEmissionsCarAllowance", zeroEmissionsCarAllowance, setZeroEmissionsCarAllowance],
                ["tradingIncomeAllowance", tradingIncomeAllowance, setTradingIncomeAllowance],
              ] as [string, string, React.Dispatch<React.SetStateAction<string>>][])
                  .map(([id, val, setter]) => (
                      <div key={id}>
                        <label className="label" htmlFor={id}>
                          {id}
                        </label>
                        <input
                            id={id}
                            type="number"
                            step="0.01"
                            className="input"
                            value={val}
                            onChange={(e) => setter(e.target.value)}
                        />
                      </div>
                  ))}
            </div>
          </details>

          {/* Non-Financials */}
          <fieldset className="border p-4 rounded">
            <legend className="font-semibold">Non-Financials</legend>
            <div>
              <label className="label flex items-center gap-2" htmlFor="businessDetailsChangedRecently">
                <input
                    id="businessDetailsChangedRecently"
                    type="checkbox"
                    checked={businessDetailsChangedRecently}
                    onChange={(e) => setBusinessDetailsChangedRecently(e.target.checked)}
                    required
                />
                Business details changed recently (required)
              </label>
            </div>
            <div>
              <label className="label" htmlFor="class4NicsExemptionReason">
                Class 4 NICs Exemption Reason
              </label>
              <select
                  id="class4NicsExemptionReason"
                  className="input"
                  value={class4NicsExemptionReason}
                  onChange={(e) => setClass4NicsExemptionReason(e.target.value)}
              >
                <option value="">-- Select reason --</option>
                <option value="non-resident">Non-resident</option>
                <option value="trustee">Trustee</option>
                <option value="diver">Diver</option>
                <option value="ITTOIA-2005">ITTOIA-2005</option>
                <option value="over-state-pension-age">Over state pension age</option>
                <option value="under-16">Under 16</option>
              </select>
            </div>
          </fieldset>

          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Next"}
          </button>
        </form>
      </StepLayout>
  );
}
