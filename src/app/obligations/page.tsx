"use client";
import { useEffect, useState } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

interface Obligation {
    periodStartDate?: string;
    periodEndDate?: string;
    dueDate?: string;
    receivedDate?: string;
    status?: string;
    businessType?: string;
    businessId?: string;
}

interface BusinessObligation {
    typeOfBusiness: string;
    businessId: string;
    obligationDetails: Obligation[];
}

interface ApiResponse {
    obligations: BusinessObligation[];
}

interface FinalObligationResponse {
    obligations: Obligation[];
}

export default function ObligationsPage() {
    const { nino, hmrcToken } = useAppState();
    const [obligations, setObligations] = useState<Obligation[]>([]);
    const [finalObligations, setFinalObligations] = useState<Obligation[]>([]);
    const [selected, setSelected] = useState<Obligation | null>(null);
    const [loading, setLoading] = useState(false);
    const [finalLoading, setFinalLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [finalError, setFinalError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchObligations = async () => {
            setError(null);
            setLoading(true);
            try {
                const token =
                    hmrcToken ||
                    (typeof window !== "undefined"
                        ? sessionStorage.getItem("hmrcToken")
                        : "") ||
                    "";
                const params = new URLSearchParams({ nino: nino || "", token });
                const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
                if (!baseUrl) {
                    throw new Error("Backend base URL is not configured");
                }
                const headers = getOrGenerateAndPersistFraudHeaders();
                const res = await axios.get<ApiResponse>(
                    `${baseUrl}/api/external/getObligationDetail?${params.toString()}`,
                    { headers }
                );
                const data = res.data;

                // Flatten all obligations but keep business info
                const allObligations = (data?.obligations || []).flatMap(
                    (business: BusinessObligation) =>
                        (business.obligationDetails || []).map((obligation: Obligation) => ({
                            ...obligation,
                            businessType: business.typeOfBusiness,
                            businessId: business.businessId,
                        }))
                );

                setObligations(allObligations);
            } catch (e: any) {
                setError(e?.message || "Failed to load obligations");
            } finally {
                setLoading(false);
            }
        };
        if (nino) fetchObligations();
    }, [nino, hmrcToken]);

    useEffect(() => {
        const fetchFinalObligations = async () => {
            setFinalError(null);
            setFinalLoading(true);
            try {
                const token =
                    hmrcToken ||
                    (typeof window !== "undefined"
                        ? sessionStorage.getItem("hmrcToken")
                        : "") ||
                    "";
                const params = new URLSearchParams({ nino: nino || "", token });
                const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
                if (!baseUrl) {
                    throw new Error("Backend base URL is not configured");
                }
                const headers = getOrGenerateAndPersistFraudHeaders();
                const res = await axios.get<FinalObligationResponse>(
                    `${baseUrl}/api/external/getFinalObligationDetail?${params.toString()}`,
                    { headers }
                );
                const data = res.data;

                setFinalObligations(data?.obligations || []);
            } catch (e: any) {
                setFinalError(e?.message || "Failed to load final obligations");
            } finally {
                setFinalLoading(false);
            }
        };
        if (nino) fetchFinalObligations();
    }, [nino, hmrcToken]);

    const onContinue = () => {
        if (!selected) return;
        const from = selected.periodStartDate || "";
        const to = selected.periodEndDate || "";
        sessionStorage.setItem("period_from", from);
        sessionStorage.setItem("period_to", to);
        if (!sessionStorage.getItem("taxYear")) {
            try {
                const y = new Date(to).getFullYear();
                const yy = String((y + 1) % 100).padStart(2, "0");
                sessionStorage.setItem("taxYear", `${y}-${yy}`);
            } catch {}
        }
        router.push("/period-summary");
    };

    // Group obligations by businessId
    const grouped = obligations.reduce((acc: any, ob: Obligation) => {
        if (!ob.businessId) return acc;
        if (!acc[ob.businessId]) {
            acc[ob.businessId] = {
                businessType: ob.businessType,
                businessId: ob.businessId,
                obligations: [],
            };
        }
        acc[ob.businessId].obligations.push(ob);
        return acc;
    }, {});

    return (
        <StepLayout
            title="Step 4: Obligations"
            backHref="/business-details"
            next={
                <button
                    className="btn-primary"
                    onClick={onContinue}
                    disabled={!selected}
                >
                    Next
                </button>
            }
        >
            {loading && <p>Loading obligations...</p>}
            {error && <p className="error">{error}</p>}
            {!loading && obligations.length > 0 && (
                <div className="space-y-6">
                    {Object.values(grouped).map((business: any) => (
                        <div
                            key={business.businessId}
                            className="border rounded-lg p-4 shadow-sm"
                        >
                            <h2 className="font-bold text-lg mb-2">
                                {business.businessType} ({business.businessId})
                            </h2>

                            {["open", "fulfilled"].map((status) => {
                                const filtered = business.obligations.filter(
                                    (o: Obligation) => o.status === status
                                );
                                if (filtered.length === 0) return null;
                                return (
                                    <div key={status} className="mb-3">
                                        <h3 className="font-medium text-md mb-1 capitalize text-gray-700">
                                            {status} obligations
                                        </h3>
                                        <ul className="space-y-2">
                                            {filtered.map((o: Obligation, idx: number) => (
                                                <li
                                                    key={`${o.periodStartDate}-${o.periodEndDate}-${idx}`}
                                                    className={`border rounded p-3 ${
                                                        o.status === "open"
                                                            ? "bg-red-50 border-red-300"
                                                            : "bg-green-50 border-green-300"
                                                    }`}
                                                >
                                                    <label className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="obligation"
                                                            onChange={() => setSelected(o)}
                                                        />
                                                        <div>
                                                            <p className="text-sm font-medium">
                                                                {o.periodStartDate} → {o.periodEndDate}
                                                            </p>
                                                            <p className="text-xs text-gray-600">
                                                                Due: {o.dueDate}
                                                                {o.receivedDate &&
                                                                    ` | Received: ${o.receivedDate}`}
                                                            </p>
                                                        </div>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
            {!loading && obligations.length === 0 && (
                <p className="help">No obligations found.</p>
            )}

            {/* Final Obligations Section */}
            <div className="mt-8 pt-6 border-t-2 border-gray-300">
                <h2 className="font-bold text-xl mb-4 text-gray-800">Final Declaration Obligations</h2>

                {finalLoading && <p className="text-gray-600">Loading final obligations...</p>}
                {finalError && <p className="error">{finalError}</p>}

                {!finalLoading && finalObligations.length > 0 && (
                    <div className="border rounded-lg p-4 shadow-sm bg-purple-50 border-purple-300">
                        <h3 className="font-medium text-md mb-3 text-purple-900">
                            Final Declaration Status
                        </h3>
                        <ul className="space-y-2">
                            {finalObligations.map((o: Obligation, idx: number) => (
                                <li
                                    key={`final-${o.periodStartDate}-${o.periodEndDate}-${idx}`}
                                    className={`border rounded p-3 ${
                                        o.status === "open"
                                            ? "bg-yellow-50 border-yellow-300"
                                            : "bg-blue-50 border-blue-300"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    o.status === "open"
                                                        ? "bg-yellow-100 text-yellow-800"
                                                        : "bg-blue-100 text-blue-800"
                                                }`}>
                                                    {o.status?.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900">
                                                Period: {o.periodStartDate} → {o.periodEndDate}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Due Date: {o.dueDate}
                                            </p>
                                            {o.receivedDate && (
                                                <p className="text-xs text-gray-600">
                                                    Received: {o.receivedDate}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!finalLoading && finalObligations.length === 0 && (
                    <p className="text-gray-500 text-sm">No final declaration obligations found.</p>
                )}
            </div>
        </StepLayout>
    );
}