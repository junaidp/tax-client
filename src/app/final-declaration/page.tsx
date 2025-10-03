"use client";
import { useState, useEffect } from "react";
import { StepLayout } from "@/components/StepLayout";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";

export default function FinalDeclarationPage() {
  const { nino, taxYear } = useAppState();
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || "");
  const [calculationId, setCalculationId] = useState<string>(
      typeof window !== "undefined"
          ? sessionStorage.getItem("calculationId") || ""
          : ""
  );
  const [calculationType, setCalculationType] = useState<string>("final-declaration");
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  // Decide available calculation types based on tax year
  useEffect(() => {
    const yearNum = parseInt(localTaxYear, 10);
    if (!isNaN(yearNum)) {
      if (yearNum <= 2425) {
        setAvailableTypes(["final-declaration"]);
        setCalculationType("final-declaration");
      } else {
        setAvailableTypes(["final-declaration", "confirm-amendment"]);
        if (!["final-declaration", "confirm-amendment"].includes(calculationType)) {
          setCalculationType("final-declaration");
        }
      }
    }
  }, [localTaxYear]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("hmrcToken") || "";
      const params = new URLSearchParams({
        nino: nino || "",
        taxYear: localTaxYear,
        calculationId: calculationId || "",
        token,
        calculationType,
      });
      const headers = getOrGenerateAndPersistFraudHeaders();
      const res = await apiClient.post(
        `/api/external/finalDeclaration?${params.toString()}`,
        {},
        { headers }
      );
      setReceipt(res);
    } catch (e: any) {
      setError(e?.message || "Failed to submit final declaration");
    } finally {
      setLoading(false);
    }
  };

  return (
      <StepLayout
          title="Step 43: Final Declaration"
          backHref="/calculation"
          next={
            <button
                className="btn-primary"
                onClick={submit}
                disabled={!nino || !localTaxYear || !calculationId || loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          }
      >
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="label" htmlFor="taxYear">
              Tax year
            </label>
            <input
                id="taxYear"
                className="input"
                value={localTaxYear}
                onChange={(e) => setLocalTaxYear(e.target.value)}
            />
          </div>

          {/* Calculation Type Buttons */}
          <div>
            <label className="label">Calculation type</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {availableTypes.map((type) => (
                  <button
                      key={type}
                      type="button"
                      onClick={() => setCalculationType(type)}
                      className={`px-4 py-2 rounded-full border transition ${
                          calculationType === type
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                      }`}
                  >
                    {type}
                  </button>
              ))}
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          {receipt && (
              <div className="mt-4 border rounded p-4">
                <h3 className="font-semibold mb-2">Submission Receipt</h3>
                <pre className="text-sm overflow-auto whitespace-pre-wrap">
              {JSON.stringify(receipt, null, 2)}
            </pre>
              </div>
          )}
        </div>
      </StepLayout>
  );
}
