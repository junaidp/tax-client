"use client";
import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "@/components/StepLayout";
import axios from "axios";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import { getOrGenerateAndPersistFraudHeaders } from "@/lib/fraudHeadersFrontend";
import {
    ArrowPathIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
    BriefcaseIcon,
    BuildingOffice2Icon
} from "@heroicons/react/24/outline";

// --- Enums and Types ---
type LossType = "self-employment" | "uk-property" | "foreign-property";
type ClaimType = "carry-forward" | "carry-sideways" | "carry-sideways-fhl" | "carry-forward-to-carry-sideways";

interface LossClaim {
    claimId: string;
    taxYearClaimedFor: string;
    typeOfLoss: LossType;
    typeOfClaim: ClaimType;
    businessId: string;
    // Assume listLossClaims returns more details, like loss amount
    lossAmount?: number;
    claimStatus?: string;
}

interface LossInput {
    taxYearClaimedFor: string;
    typeOfLoss: LossType;
    typeOfClaim: ClaimType;
    businessId: string;
}

// Data for Loss Type selector (uses same icons as bsas-adjust.tsx)
const LOSS_TYPES: { id: LossType, label: string, icon: React.ElementType }[] = [
    { id: "self-employment", label: "Self-Employment", icon: BriefcaseIcon },
    { id: "uk-property", label: "UK Property", icon: BuildingOffice2Icon },
    { id: "foreign-property", label: "Foreign Property", icon: BuildingOffice2Icon },
];

export default function LossesPage() {
    const { nino, hmrcToken, businessId: appBusinessId } = useAppState();
    const router = useRouter();

    const [localTaxYear, setLocalTaxYear] = useState<string>(
        typeof window !== "undefined" ? sessionStorage.getItem("taxYear") || "" : ""
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

    // --- Loss Management States ---
    const [losses, setLosses] = useState<LossClaim[]>([]);
    const [listLossesExpanded, setListLossesExpanded] = useState(true); // Start expanded for visibility
    const [listLossesLoading, setListLossesLoading] = useState(false);

    const [createLossExpanded, setCreateLossExpanded] = useState(false);
    const [createLossLoading, setCreateLossLoading] = useState(false);

    const [newLossInputs, setNewLossInputs] = useState<LossInput>({
        taxYearClaimedFor: "",
        typeOfLoss: "self-employment",
        typeOfClaim: "carry-forward",
        businessId: appBusinessId || "",
    });

    // --- Dynamic Claim Types based on Loss Type ---
    const getClaimTypesForLoss = (lossType: LossType): ClaimType[] => {
        if (lossType === "self-employment") {
            return ["carry-forward", "carry-sideways"];
        }
        return ["carry-sideways", "carry-sideways-fhl", "carry-forward-to-carry-sideways"];
    };

    // --- API Handlers ---

    // 1. List Losses (Called on load and after creation/amendment)
    const fetchLossClaims = useCallback(async (currentTaxYear: string) => {
        if (!baseUrl || !nino || !hmrcToken || !currentTaxYear) return;

        setListLossesLoading(true);
        setError(null);

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();
            const response = await axios.post(
                `${baseUrl}/api/external/listLossClaims`,
                {}, // POST body is empty as per many HMRC endpoints using POST for GET-like ops
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                        taxYear: currentTaxYear,
                    },
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Assume the response contains a 'losses' array
            setLosses(response.data.losses || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to fetch loss claims.");
            setLosses([]);
        } finally {
            setListLossesLoading(false);
        }
    }, [baseUrl, nino, hmrcToken]);

    // Initial load of losses
    useEffect(() => {
        if (localTaxYear) {
            fetchLossClaims(localTaxYear);
        }
    }, [localTaxYear, fetchLossClaims]);


    // 2. Create Loss Claim
    const handleCreateLoss = async () => {
        if (!baseUrl || !nino || !hmrcToken) return;

        setCreateLossLoading(true);
        setError(null);

        // Simple validation
        if (!newLossInputs.taxYearClaimedFor || !newLossInputs.businessId) {
            setError("Tax Year Claimed For and Business ID are required.");
            setCreateLossLoading(false);
            return;
        }

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();
            const requestBody = JSON.stringify(newLossInputs);

            await axios.get( // Note: API spec says GET, which is unusual for a create, but we'll follow it
                `${baseUrl}/api/external/createLossClaims`,
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                        body: requestBody,
                    },
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                }
            );

            alert("Loss Claim created successfully! Refreshing list...");
            setCreateLossExpanded(false);
            await fetchLossClaims(localTaxYear); // Refresh the list
            setNewLossInputs(prev => ({
                ...prev,
                taxYearClaimedFor: "",
                businessId: appBusinessId || "",
            })); // Clear inputs
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to create loss claim.");
        } finally {
            setCreateLossLoading(false);
        }
    };

    // 5. Delete Loss Claim (Implemented on the rendered list item)
    const handleDeleteLoss = async (claimId: string) => {
        if (!baseUrl || !nino || !hmrcToken || !localTaxYear || !confirm(`Are you sure you want to delete claim ${claimId}?`)) return;

        setLoading(true); // Use general loading for actions
        setError(null);

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();
            await axios.delete(
                `${baseUrl}/api/external/deleteLossClaim`,
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                        taxYear: localTaxYear,
                        claimId: claimId,
                    },
                    headers,
                }
            );

            alert(`Loss Claim ${claimId} deleted successfully!`);
            await fetchLossClaims(localTaxYear); // Refresh the list
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to delete loss claim.");
        } finally {
            setLoading(false);
        }
    };


    // --- UI Renderers ---

    const renderLossesList = () => {
        if (listLossesLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-6">
                    <ArrowPathIcon className="animate-spin h-8 w-8 text-blue-600 mb-3" />
                    <p className="text-gray-600">Fetching loss claims for {localTaxYear}...</p>
                </div>
            );
        }
        if (losses.length === 0) {
            return (
                <p className="text-sm text-gray-600 p-4 bg-gray-50 rounded-md">
                    No loss claims found for Tax Year {localTaxYear}.
                </p>
            );
        }

        return (
            <div className="space-y-3">
                {losses.map((claim) => (
                    <div key={claim.claimId} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                **{claim.typeOfLoss.toUpperCase().replace('-', ' ')}** Loss ({claim.businessId})
                            </p>
                            <p className="text-xs text-gray-600">
                                Claim ID: <span className="font-mono">{claim.claimId}</span> |
                                Claim Type: <span className="font-medium">{claim.typeOfClaim.replace(/-/g, ' ').toUpperCase()}</span>
                            </p>
                            <p className="text-xs text-gray-600">
                                Tax Year Claimed For: **{claim.taxYearClaimedFor}**
                            </p>
                        </div>
                        <div className="flex space-x-2">
                            {/* Amend Order and Amend Type buttons are placeholders as they require separate forms */}
                            <button className="p-2 text-blue-600 hover:text-blue-800 transition" title="Amend Claim Type">
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => handleDeleteLoss(claim.claimId)}
                                className="p-2 text-red-600 hover:text-red-800 transition"
                                title="Delete Claim"
                                disabled={loading}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderCreateLossForm = () => {
        const availableClaimTypes = getClaimTypesForLoss(newLossInputs.typeOfLoss);

        return (
            <form className="space-y-4">
                {/* 1. Loss Type Selector */}
                <p className="text-sm font-medium text-gray-700 mb-2">Type of Loss:</p>
                <div className="flex space-x-4 mb-4">
                    {LOSS_TYPES.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                setNewLossInputs(prev => ({
                                    ...prev,
                                    typeOfLoss: id,
                                    // Reset claim type to the first valid one for the new loss type
                                    typeOfClaim: getClaimTypesForLoss(id)[0]
                                }));
                            }}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-150 w-1/3 text-center ${
                                newLossInputs.typeOfLoss === id
                                    ? "border-blue-500 bg-blue-100 shadow-lg scale-[1.02]"
                                    : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                            }`}
                        >
                            <Icon className={`h-8 w-8 ${newLossInputs.typeOfLoss === id ? 'text-blue-600' : 'text-gray-500'} mb-2`} />
                            <span className="text-sm font-medium text-gray-800">{label}</span>
                        </button>
                    ))}
                </div>

                {/* 2. Tax Year Claimed For */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="taxYearClaimedForInput">
                        Tax Year Claimed For (e.g., 2023-24)
                    </label>
                    <input
                        id="taxYearClaimedForInput"
                        type="text"
                        value={newLossInputs.taxYearClaimedFor}
                        onChange={(e) => setNewLossInputs(prev => ({ ...prev, taxYearClaimedFor: e.target.value.trim() }))}
                        placeholder="Enter Tax Year"
                        className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                {/* 3. Business ID */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="businessIdInput">
                        Business ID (e.g., XAIS12345678910)
                    </label>
                    <input
                        id="businessIdInput"
                        type="text"
                        value={newLossInputs.businessId}
                        onChange={(e) => setNewLossInputs(prev => ({ ...prev, businessId: e.target.value.trim() }))}
                        placeholder="Enter Business ID"
                        className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                    {appBusinessId && (
                        <p className="text-xs text-gray-500 mt-1 text-gray-600">Default value loaded from session: <span className="font-mono">{appBusinessId}</span></p>
                    )}
                </div>

                {/* 4. Type of Claim */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="typeOfClaimSelect">
                        Type of Claim:
                    </label>
                    <select
                        id="typeOfClaimSelect"
                        value={newLossInputs.typeOfClaim}
                        onChange={(e) => setNewLossInputs(prev => ({ ...prev, typeOfClaim: e.target.value as ClaimType }))}
                        className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                        required
                    >
                        {availableClaimTypes.map(type => (
                            <option key={type} value={type}>
                                {type.replace(/-/g, ' ').toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={handleCreateLoss}
                        disabled={createLossLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {createLossLoading ? (
                            <>
                                <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" />
                                Creating...
                            </>
                        ) : (
                            "Create New Loss Claim"
                        )}
                    </button>
                </div>
            </form>
        );
    };


    return (
        <StepLayout title="Step 25: Loss Claims Management" backHref="/bsas-adjust" next={null}>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Tax Year Input and Actions */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <p className="font-semibold mb-3 text-lg">Tax Year</p>
                    <div className="flex items-end justify-between gap-4">
                        <div className="max-w-xs flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taxYearInput">
                                Tax Year (e.g., 2024-25)
                            </label>
                            <input
                                id="taxYearInput"
                                type="text"
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g. 2024-25"
                                value={localTaxYear}
                                onChange={(e) => {
                                    setLocalTaxYear(e.target.value.trim());
                                    // Optionally trigger fetch on tax year change
                                    fetchLossClaims(e.target.value.trim());
                                }}
                                required
                            />
                        </div>

                        {/* Action Buttons (List & Create) */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setListLossesExpanded(prev => !prev)}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                                <ArrowPathIcon className="h-5 w-5 mr-2" />
                                List Claims
                                {listLossesExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreateLossExpanded(prev => !prev)}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Create New Claim
                                {createLossExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collapsible List Losses Section (BLUE/GRAY) */}
                {listLossesExpanded && (
                    <div className="mt-2 border border-blue-200 rounded-lg bg-gradient-to-br from-blue-50 to-gray-50 overflow-hidden shadow-sm">
                        <div className="p-6">
                            <h6 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                                <ArrowPathIcon className="h-5 w-5 mr-2 text-blue-600" />
                                Existing Loss Claims for {localTaxYear}
                            </h6>
                            {renderLossesList()}
                        </div>
                    </div>
                )}

                {/* Collapsible Create Loss Claim Section (GREEN/LIME) */}
                {createLossExpanded && (
                    <div className="mt-2 border border-green-300 rounded-lg bg-gradient-to-br from-green-50 to-lime-50 overflow-hidden shadow-sm">
                        <div className="p-6">
                            <div className="bg-gradient-to-r from-green-50 to-lime-50 rounded-lg border-2 border-green-200 p-6">
                                <h6 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                                    <PlusIcon className="h-5 w-5 mr-2 text-green-600" />
                                    Create New Loss Claim
                                </h6>
                                {renderCreateLossForm()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Placeholder for Amend Loss Claim by Order/Type */}
                <div className="bg-white p-6 rounded-lg shadow-md border-t border-gray-200">
                    <p className="font-semibold text-lg mb-2">Advanced: Amend Loss Claim Order/Type</p>
                    <p className="text-sm text-gray-600">
                        The functionality for **Amend Loss Claim By Order** (`PUT /amendLossClaimOrder`) and **Amend Loss Claim By Type** (`POST /amendLossClaimType`) would be implemented here, likely using a modal or another collapsible form to select claims and define the new sequence/type.
                    </p>
                    <p className="text-xs text-red-500 mt-2">
                        *Note: These specific forms have been omitted for brevity, but the necessary API handlers (3 & 4) would reside in this component.*
                    </p>
                </div>


                {error && (
                    <div className="text-red-500 text-sm mt-2 p-3 border border-red-300 bg-red-50 rounded">
                        {error}
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <button
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        type="button"
                        onClick={() => router.push("/next-step")} // Update to your next route
                        disabled={loading}
                    >
                        Continue to Next Step
                    </button>
                </div>
            </div>
        </StepLayout>
    );
}