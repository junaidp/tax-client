"use client";
import { useState } from "react";
import axios from "axios";
import { StepLayout } from "@/components/StepLayout";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";

export default function FinalCalcTriggerPage() {
  const { nino, taxYear } = useAppState();
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || "");
  const [calculationType, setCalculationType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Decide allowed calculation types based on taxYear
  const getAllowedCalculationTypes = () => {
    if (!localTaxYear) return [];
    const yearStart = parseInt(localTaxYear.split("-")[0], 10);

    if (yearStart <= 2023 || yearStart === 2024) {
      return ["in-year", "intent-to-finalise"];
    }
    return ["in-year", "intent-to-finalise", "intent-to-amend"];
  };

  const trigger = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("hmrcToken") || "";
      const params = new URLSearchParams({
        nino: nino || "",
        taxYear: localTaxYear,
        token,
        calculationType,
      });
      const headers = getOrGenerateAndPersistFraudHeaders();
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error("Backend base URL is not configured");
      }
      const res = await axios.post(
        `${baseUrl}/api/external/triggerFinal?${params.toString()}`,
        {},
        { headers }
      );
      const calculationId =  res?.data?.calculationId || res?.data?.id;
      if (calculationId) sessionStorage.setItem("calculationId", calculationId);
      sessionStorage.setItem("taxYear", localTaxYear);
      router.push("/calculation");
    } catch (e: any) {
      const responseData = e?.response?.data;
      const serverMessage = responseData?.data?.message || responseData?.message;
      setError(serverMessage || e?.message || "Failed to trigger final calculation");
    } finally {
      setLoading(false);
    }
  };

  return (
      <StepLayout
          title="Step 34: Trigger Final Calculation"
          backHref="/dividends"
          next={
            <button
                className="btn-primary"
                onClick={trigger}
                disabled={!localTaxYear || !calculationType || loading}
            >
              {loading ? "Triggering..." : "Next"}
            </button>
          }
      >
        <div className="space-y-6 max-w-lg">
          {/* Tax Year Input */}
          <div>
            <label className="label" htmlFor="taxYear">Tax year</label>
            <input
                id="taxYear"
                className="input"
                value={localTaxYear}
                onChange={(e) => {
                  setLocalTaxYear(e.target.value);
                  setCalculationType(""); // reset selection if year changes
                }}
                required
                placeholder="e.g., 2023-24"
            />
          </div>

          {/* Calculation Type Chips */}
          <div>
            <label className="label">Calculation type</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {getAllowedCalculationTypes().map((type) => (
                  <button
                      key={type}
                      type="button"
                      onClick={() => setCalculationType(type)}
                      className={`px-4 py-2 rounded-full border transition 
                  ${calculationType === type
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"}`}
                  >
                    {type}
                  </button>
              ))}
            </div>
            {!calculationType && (
                <p className="text-sm text-gray-500 mt-1"></p>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      </StepLayout>
  );
}
