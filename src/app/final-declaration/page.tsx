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
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState<string>("");
  const [popupSuccess, setPopupSuccess] = useState(false);

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
      setPopupContent(JSON.stringify(res, null, 2));
      setPopupSuccess(true);
      setShowPopup(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit final Declaration");
      setPopupContent("");
      setPopupSuccess(false);
      setShowPopup(false);
    } finally {
      setLoading(false);
    }
  };

  return (
      <StepLayout
          title="Step 43: Final Declaration"
          backHref="/calculation"
          next={
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <p className="mb-2">I confirm that the information I have provided is complete and correct to the best of my knowledge.</p>
                <p className="mb-4">I understand that it is a serious offence to make a false declaration and that penalties may be imposed for false or incorrect information.</p>
                <label className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                  />
                  <span>I confirm the above is true and I agree to submit this declaration.</span>
                </label>
              </div>
              <button
                  className="btn-primary w-full"
                  onClick={submit}
                  disabled={!nino || !localTaxYear || !calculationId || loading || !isConfirmed}
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>
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
        {showPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full relative flex flex-col items-center">
              <button
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none"
                onClick={() => setShowPopup(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                &times;
              </button>
              <h2 className="text-lg font-semibold mb-4"></h2>
              {popupSuccess && (
                <div className="mb-4 text-green-700 font-semibold text-base text-center">Final Declaration successfully submitted</div>
              )}
              {popupContent && popupContent !== '""' && (
                <pre className="text-xs whitespace-pre-wrap break-all mb-4 text-center">{popupContent}</pre>
              )}
            </div>
          </div>
        )}
      </StepLayout>
  );
}
