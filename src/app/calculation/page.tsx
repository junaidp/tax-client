"use client";
import { useEffect, useState } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";
import { useRouter } from "next/navigation";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

export default function CalculationPage() {
  const { nino, taxYear } = useAppState();
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || "");
  const [calculationId, setCalculationId] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

          {/* JSON Viewer */}
          {result && (
              <div className="border rounded shadow p-4 bg-white">
                <h3 className="font-semibold text-lg mb-4">Calculation Response</h3>
                <div className="text-sm max-h-[500px] overflow-auto">
                  <JsonView data={result}  />
                </div>
              </div>
          )}
        </div>
      </StepLayout>
  );
}
