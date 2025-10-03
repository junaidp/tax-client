"use client";
import { useState, useEffect } from "react";
import { StepLayout } from "@/components/StepLayout";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

export default function BsasTriggerPage() {
  const { nino, businessId: globalBusinessId, taxYear, hmrcToken } = useAppState();

  const [selectedTab, setSelectedTab] = useState<"2024-25" | "2025-26+">("2024-25");
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || "2024-25");
  const [businessId, setBusinessId] = useState(globalBusinessId || "");
  const [typeOfBusiness, setTypeOfBusiness] = useState<"self-employment" | "uk-property" | "foreign-property">("self-employment");
  const [accountingPeriodStart, setAccountingPeriodStart] = useState(""); // required but not shown to user (see note)
  const [accountingPeriodEnd, setAccountingPeriodEnd] = useState("");   // required but not shown to user

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Default to 2024-25
    if (!localTaxYear) {
      setLocalTaxYear("2024-25");
    }
  }, []);

  const trigger = async () => {
    setError(null);
    setLoading(true);
    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") ||
          "";

      const params = new URLSearchParams({ nino: nino || "", token });

      // Construct request body
      const body: any = {
        accountingPeriod: {
          startDate: accountingPeriodStart || "2024-04-06", // fallback defaults (not displayed to user)
          endDate: accountingPeriodEnd || "2025-04-05",
        },
        typeOfBusiness,
        businessId,
        taxYear: localTaxYear,
      };
      const headers = getOrGenerateAndPersistFraudHeaders();
      const res = await apiClient.post(
          `/api/external/bsasTrigger?${params.toString()}`,
          body,
          { headers }
      );

      const calculationId =
          res?.calculationId || res?.id || res?.data?.calculationId;
      if (calculationId) {
        sessionStorage.setItem("calculationId", calculationId);
      }
      router.push("/bsas-adjust");
    } catch (e: any) {
      setError(e?.message || "Failed to trigger BSAS");
    } finally {
      setLoading(false);
    }
  };

  return (
      <StepLayout
          title="Step 22: Trigger BSAS"
          backHref="/annual-submission"
          next={
            <button
                className="btn-primary"
                onClick={trigger}
                disabled={!localTaxYear || !businessId || loading}
            >
              {loading ? "Triggering..." : "Next"}
            </button>
          }
      >
        <div className="space-y-4 max-w-lg">
          {/* Tabs */}
          <div className="flex space-x-4 border-b">
            <button
                type="button"
                className={`px-4 py-2 ${
                    selectedTab === "2024-25" ? "border-b-2 border-blue-600 font-semibold" : ""
                }`}
                onClick={() => {
                  setSelectedTab("2024-25");
                  setLocalTaxYear("2024-25");
                }}
            >
              For TY 2024-25
            </button>
            <button
                type="button"
                className={`px-4 py-2 ${
                    selectedTab === "2025-26+" ? "border-b-2 border-blue-600 font-semibold" : ""
                }`}
                onClick={() => {
                  setSelectedTab("2025-26+");
                  setLocalTaxYear("2025-26 and after");
                }}
            >
              For TY 2025-26 and after
            </button>
          </div>

          {/* Business ID */}
          <div>
            <label className="label" htmlFor="businessId">Business ID</label>
            <input
                id="businessId"
                className="input"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                required
            />
          </div>

          {/* Type of Business */}
          <div>
            <label className="label" htmlFor="typeOfBusiness">Type of Business</label>
            <select
                id="typeOfBusiness"
                className="input"
                value={typeOfBusiness}
                onChange={(e) => setTypeOfBusiness(e.target.value as any)}
                required
            >
              <option value="self-employment">Self-employment</option>
              <option value="uk-property">UK Property</option>
              <option value="foreign-property">Foreign Property</option>
            </select>
          </div>

          {/* Hidden Accounting Period (not shown to user, but required by API) */}
          <input type="hidden" value={accountingPeriodStart} readOnly />
          <input type="hidden" value={accountingPeriodEnd} readOnly />

          {error && <p className="error">{error}</p>}
        </div>
      </StepLayout>
  );
}
