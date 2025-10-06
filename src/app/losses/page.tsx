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
    BuildingOffice2Icon,
    CurrencyPoundIcon,
    ArrowLongRightIcon,
    ArrowLeftOnRectangleIcon,
    ArrowRightOnRectangleIcon,
    CalendarDaysIcon,
    IdentificationIcon,
    ClockIcon,
    ListBulletIcon,
    XMarkIcon, // Added for modal close button
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
    sequence?: number;
    lastModified?: string;
}

interface LossInput {
    taxYearClaimedFor: string;
    typeOfLoss: LossType;
    typeOfClaim: ClaimType;
    businessId: string;
}

const LOSS_TYPES: { id: LossType, label: string, icon: React.ElementType }[] = [
    { id: "self-employment", label: "Self-Employment", icon: BriefcaseIcon },
    { id: "uk-property", label: "UK Property", icon: BuildingOffice2Icon },
    { id: "foreign-property", label: "Foreign Property", icon: BuildingOffice2Icon },
];

const CLAIM_TYPES: { id: ClaimType, label: string, icon: React.ElementType, lossTypes: LossType[] }[] = [
    {
        id: "carry-forward",
        label: "Carry Forward",
        icon: ArrowLongRightIcon,
        lossTypes: ["self-employment"]
    },
    {
        id: "carry-sideways",
        label: "Carry Sideways",
        icon: CurrencyPoundIcon,
        lossTypes: ["self-employment", "uk-property", "foreign-property"]
    },
    {
        id: "carry-sideways-fhl",
        label: "Carry Sideways FHL",
        icon: ArrowLeftOnRectangleIcon,
        lossTypes: ["uk-property", "foreign-property"]
    },
    {
        id: "carry-forward-to-carry-sideways",
        label: "Forward to Sideways",
        icon: ArrowRightOnRectangleIcon,
        lossTypes: ["uk-property", "foreign-property"]
    },
];

// Helper function to get readable labels
const getLossTypeLabel = (id: LossType) => LOSS_TYPES.find(l => l.id === id)?.label || id;
const getClaimTypeInfo = (id: ClaimType) => CLAIM_TYPES.find(c => c.id === id);


export default function LossesPage() {
    const { nino, hmrcToken, businessId: appBusinessId } = useAppState();
    const router = useRouter();

    const [localTaxYear, setLocalTaxYear] = useState<string>(() => {
        const sessionTaxYear = typeof window !== "undefined" ? sessionStorage.getItem("taxYear") : null;

        if (sessionTaxYear && sessionTaxYear.trim() !== "") {
            return sessionTaxYear;
        }
        return "2025-26";
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

    // --- Loss Management States ---
    const [losses, setLosses] = useState<LossClaim[]>([]);
    const [listLossesExpanded, setListLossesExpanded] = useState(true);
    const [listLossesLoading, setListLossesLoading] = useState(false);

    const [createLossExpanded, setCreateLossExpanded] = useState(false);
    const [createLossLoading, setCreateLossLoading] = useState(false);

    // --- NEW STATE for Amend Modal ---
    interface ClaimToAmend {
        claimId: string;
        currentType: ClaimType;
        lossType: LossType;
    }
    const [claimToAmend, setClaimToAmend] = useState<ClaimToAmend | null>(null);
    const amendModalOpen = !!claimToAmend;


    const [newLossInputs, setNewLossInputs] = useState<LossInput>({
        taxYearClaimedFor: "",
        typeOfLoss: "self-employment",
        typeOfClaim: "carry-forward",
        businessId: appBusinessId || "",
    });

    // --- Dynamic Claim Types based on Loss Type ---
    const getClaimTypesForLoss = (lossType: LossType): ClaimType[] => {
        return CLAIM_TYPES.filter(type => type.lossTypes.includes(lossType)).map(type => type.id);
    };

    // --- API Handlers ---

    // 1. List Losses (GET and handle 'claims' array)
    const fetchLossClaims = useCallback(async (currentTaxYear: string) => {
        if (!baseUrl || !nino || !hmrcToken || !currentTaxYear) return;

        setListLossesLoading(true);
        setError(null);

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();

            // API: GET "/api/external/listLossClaims"
            const response = await axios.get(
                `${baseUrl}/api/external/listLossClaims`,
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                        taxYear: currentTaxYear,
                    },
                    headers,
                }
            );

            setLosses(response.data.claims || []);
        } catch (e: any) {
            console.error("Fetch Losses Error:", e);
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


    // 2. Create Loss Claim (POST with request body)
    const handleCreateLoss = async () => {
        if (!baseUrl || !nino || !hmrcToken) return;
        // ... (handleCreateLoss implementation remains the same)
        setCreateLossLoading(true);
        setError(null);

        if (!newLossInputs.taxYearClaimedFor || !newLossInputs.businessId || !newLossInputs.typeOfClaim) {
            setError("Tax Year Claimed For, Business ID, and Claim Type are required.");
            setCreateLossLoading(false);
            return;
        }

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();

            await axios.post(
                `${baseUrl}/api/external/createLossClaims`,
                newLossInputs,
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                    },
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                }
            );

            alert("Loss Claim created successfully! Refreshing list...");
            setCreateLossExpanded(false);
            await fetchLossClaims(localTaxYear);
            setNewLossInputs(prev => ({
                ...prev,
                taxYearClaimedFor: "",
                businessId: appBusinessId || "",
            }));
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to create loss claim.");
        } finally {
            setCreateLossLoading(false);
        }
    };

    // 3. Amend Loss Claim Type (POST with @RequestParam and @RequestBody)
    const handleAmendLossType = async (claimId: string, newClaimType: ClaimType) => {
        if (!baseUrl || !nino || !hmrcToken || !localTaxYear) return;

        // Close modal and set general loading state
        setClaimToAmend(null);
        setLoading(true);
        setError(null);

        try {
            const headers = getOrGenerateAndPersistFraudHeaders();

            // API: POST "/api/external/amendLossClaimType"
            await axios.post(
                `${baseUrl}/api/external/amendLossClaimType`,
                { // Request Body: typeOfClaim
                    typeOfClaim: newClaimType,
                },
                {
                    params: {
                        nino: nino,
                        token: hmrcToken,
                        taxYear: localTaxYear,
                        claimId: claimId,
                    },
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json', // Required for @RequestBody
                    },
                }
            );

            alert(`Loss Claim ${claimId} successfully amended to type: ${newClaimType}!`);
            await fetchLossClaims(localTaxYear);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || `Failed to amend loss claim ${claimId}.`);
        } finally {
            setLoading(false);
        }
    };

    // Handler to open the modal and set the data
    const openAmendModal = (claim: LossClaim) => {
        setClaimToAmend({
            claimId: claim.claimId,
            currentType: claim.typeOfClaim,
            lossType: claim.typeOfLoss,
        });
    };

    // 4. Delete Loss Claim
    const handleDeleteLoss = async (claimId: string) => {
        if (!baseUrl || !nino || !hmrcToken || !localTaxYear || !confirm(`Are you sure you want to delete claim ${claimId}?`)) return;

        setLoading(true);
        setError(null);
        // ... (handleDeleteLoss implementation remains the same)
        try {
            const headers = getOrGenerateAndPersistFraudHeaders();

            // API: DELETE "/api/external/deleteLossClaim"
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
            await fetchLossClaims(localTaxYear);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to delete loss claim.");
        } finally {
            setLoading(false);
        }
    };


    // --- UI Renderers ---

    const AmendClaimModal = () => {
        if (!claimToAmend) return null;

        const { claimId, currentType, lossType } = claimToAmend;
        const availableClaimTypes = getClaimTypesForLoss(lossType);

        return (
            <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backdropFilter: 'blur(3px)' }}>
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-purple-300">
                        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="flex items-start justify-between">
                                <h3 className="text-lg font-semibold leading-6 text-gray-900" id="modal-title">
                                    Amend Loss Claim Type
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setClaimToAmend(null)}
                                    className="text-gray-400 hover:text-gray-500"
                                >
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="mt-4">
                                <p className="text-sm text-gray-700 mb-4">
                                    <span className="font-bold">Claim ID:</span> <code className="bg-gray-100 p-1 rounded text-indigo-600 font-mono text-xs">{claimId}</code>
                                </p>
                                <p className="text-sm text-gray-700 mb-6">
                                    <span className="font-bold">Current Type:</span>
                                    <span className="inline-flex items-center px-2 py-0.5 ml-2 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                        {getClaimTypeInfo(currentType)?.label.toUpperCase()}
                                    </span>
                                </p>

                                <p className="text-md font-medium text-gray-900 mb-3">Select New Claim Type:</p>

                                {/* Options as Clickable Icons */}
                                <div className="grid grid-cols-2 gap-3">
                                    {CLAIM_TYPES.filter(type => availableClaimTypes.includes(type.id)).map(({ id, label, icon: Icon }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => handleAmendLossType(claimId, id)}
                                            disabled={loading || id === currentType}
                                            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-150 text-center disabled:opacity-50 disabled:cursor-not-allowed ${
                                                id === currentType
                                                    ? "border-yellow-500 bg-yellow-100 text-yellow-800"
                                                    : "border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 text-gray-800"
                                            }`}
                                        >
                                            <Icon className={`h-6 w-6 mb-2 ${id === currentType ? 'text-yellow-600' : 'text-blue-600'}`} />
                                            <span className="text-sm font-medium">{label}</span>
                                            {id === currentType && <span className="text-xs font-bold mt-1">(CURRENT)</span>}
                                        </button>
                                    ))}
                                </div>

                                {loading && (
                                    <div className="flex items-center justify-center mt-4">
                                        <ArrowPathIcon className="animate-spin h-5 w-5 mr-3 text-blue-600" />
                                        <p className="text-blue-600">Amending claim...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button
                                type="button"
                                onClick={() => setClaimToAmend(null)}
                                disabled={loading}
                                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    const renderLossesList = () => {
        if (listLossesLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-6">
                    <ArrowPathIcon className="animate-spin h-8 w-8 text-blue-600 mb-3" />
                    <p className="text-gray-600">Fetching loss claims for {localTaxYear}...</p>
                </div>
            );
        }

        if (losses.length === 0 && !listLossesLoading) {
            return (
                <p className="text-sm text-gray-600 p-4 bg-gray-50 rounded-md">
                    No loss claims found for Tax Year **{localTaxYear}**.
                </p>
            );
        }

        return (
            <div className="space-y-4">
                {losses.map((claim) => {
                    const lossTypeLabel = getLossTypeLabel(claim.typeOfLoss);
                    const claimTypeInfo = getClaimTypeInfo(claim.typeOfClaim);
                    const LossIcon = LOSS_TYPES.find(l => l.id === claim.typeOfLoss)?.icon || BriefcaseIcon;
                    const ClaimIcon = claimTypeInfo?.icon || ArrowLongRightIcon;

                    return (
                        // IMPROVED CARD UI
                        <div key={claim.claimId} className="bg-white rounded-xl shadow-lg border border-gray-100 p-5 transition-all hover:shadow-xl">

                            {/* Header Row: Loss Type & Claim Type Badge */}
                            <div className="flex justify-between items-start mb-3 border-b pb-3">
                                <h3 className="flex items-center text-lg font-bold text-gray-900">
                                    <LossIcon className="h-6 w-6 text-indigo-500 mr-2" />
                                    {lossTypeLabel} Loss
                                </h3>
                                <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                    <ClaimIcon className="h-3 w-3 mr-1" />
                                    {claimTypeInfo?.label.toUpperCase() || 'UNKNOWN CLAIM'}
                                </span>
                            </div>

                            {/* Details Grid (remains the same) */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600">
                                {/* Row 1 */}
                                <div className="flex items-center">
                                    <CalendarDaysIcon className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">Tax Year:</span>
                                    <span className="ml-1 font-semibold">{claim.taxYearClaimedFor}</span>
                                </div>
                                <div className="flex items-center">
                                    <ListBulletIcon className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">Sequence:</span>
                                    <span className="ml-1">{claim.sequence || 'N/A'}</span>
                                </div>

                                {/* Row 2 */}
                                <div className="flex items-center col-span-2 text-xs">
                                    <IdentificationIcon className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">Claim ID:</span>
                                    <code className="ml-1 bg-gray-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[11px]">{claim.claimId}</code>
                                </div>

                                {/* Row 3 */}
                                <div className="flex items-center col-span-2 text-xs">
                                    <BriefcaseIcon className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">Business ID:</span>
                                    <code className="ml-1 bg-gray-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[11px]">{claim.businessId}</code>
                                </div>

                                {/* Last Modified */}
                                <div className="flex items-center col-span-2 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                                    <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                    Last Modified:
                                    <span className="ml-1">{claim.lastModified ? new Date(claim.lastModified).toLocaleString() : 'N/A'}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                                <button
                                    className="p-2 text-blue-600 hover:text-blue-800 transition rounded-full hover:bg-blue-50 disabled:opacity-50"
                                    title="Amend Claim Type"
                                    disabled={loading || amendModalOpen}
                                    onClick={() => openAmendModal(claim)} // Open the modal
                                >
                                    <PencilSquareIcon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteLoss(claim.claimId)}
                                    className="p-2 text-red-600 hover:text-red-800 transition rounded-full hover:bg-red-50 disabled:opacity-50"
                                    title="Delete Claim"
                                    disabled={loading || amendModalOpen}
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        // END IMPROVED CARD UI
                    );
                })}
            </div>
        );
    };

    const renderCreateLossForm = () => {
        // ... (renderCreateLossForm implementation remains the same)
        const availableClaimTypes = getClaimTypesForLoss(newLossInputs.typeOfLoss);

        return (
            <form className="space-y-4">
                {/* 1. Loss Type Selector (Business Type) */}
                <p className="text-sm font-medium text-gray-700 mb-2">1. Type of Loss (Business Type):</p>
                <div className="flex space-x-4 mb-4">
                    {LOSS_TYPES.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                const newClaimTypes = getClaimTypesForLoss(id);
                                setNewLossInputs(prev => ({
                                    ...prev,
                                    typeOfLoss: id,
                                    typeOfClaim: newClaimTypes[0] || "carry-sideways" as ClaimType,
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

                {/* 2. Type of Claim Selector (Icons) */}
                <p className="text-sm font-medium text-gray-700 mb-2 mt-6">2. Type of Claim:</p>
                <div className="flex space-x-4 mb-4">
                    {CLAIM_TYPES.filter(type => availableClaimTypes.includes(type.id)).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setNewLossInputs(prev => ({ ...prev, typeOfClaim: id }))}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-150 flex-1 text-center ${
                                newLossInputs.typeOfClaim === id
                                    ? "border-purple-500 bg-purple-100 shadow-lg scale-[1.02]"
                                    : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
                            }`}
                        >
                            <Icon className={`h-8 w-8 ${newLossInputs.typeOfClaim === id ? 'text-purple-600' : 'text-gray-500'} mb-2`} />
                            <span className="text-sm font-medium text-gray-800">{label}</span>
                        </button>
                    ))}
                </div>


                {/* 3. Tax Year Claimed For */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="taxYearClaimedForInput">
                        3. Tax Year Claimed For (e.g., 2023-24)
                    </label>
                    <input
                        id="taxYearClaimedForInput"
                        type="text"
                        value={newLossInputs.taxYearClaimedFor}
                        onChange={(e) => setNewLossInputs(prev => ({ ...prev, taxYearClaimedFor: e.target.value.trim() }))}
                        placeholder="e.g. 2023-24 (min 2019-20)"
                        className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                {/* 4. Business ID */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="businessIdInput">
                        4. Business ID (e.g., XAIS12345678910)
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

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={handleCreateLoss}
                        disabled={createLossLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
                {/* Tax Year Input and Actions (remains the same) */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <p className="font-semibold mb-3 text-lg">Tax Year</p>
                    <div className="flex items-end justify-between gap-4">
                        <div className="max-w-xs flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taxYearInput">
                                Tax Year (e.g., 2025-26)
                            </label>
                            <input
                                id="taxYearInput"
                                type="text"
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g. 2024-25"
                                value={localTaxYear}
                                onChange={(e) => {
                                    const newYear = e.target.value.trim();
                                    setLocalTaxYear(newYear);
                                    fetchLossClaims(newYear);
                                }}
                                required
                            />
                        </div>

                        {/* Action Buttons (List & Create) */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setListLossesExpanded(prev => !prev);
                                    if (!listLossesExpanded) fetchLossClaims(localTaxYear);
                                }}
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

                {/* Advanced: Amend Loss Claims (Placeholder for full forms) */}
                <div className="bg-white p-6 rounded-lg shadow-md border-t border-gray-200">
                    <p className="font-semibold text-lg mb-2">Advanced: Amend Loss Claims</p>
                    <p className="text-sm text-gray-600">
                        This section lists the API functions prepared for amending claims.
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-700 ml-4 mt-2 space-y-1">
                        <li>**Amend Loss Claim By Order** (`PUT /amendLossClaimOrder`): Re-sequence claims (not implemented here).</li>
                        <li>**Amend Loss Claim By Type** (`POST /amendLossClaimType`): **Implemented via the pencil icon** (uses a modal to select the new type).</li>
                        <li>**Delete Loss Claim** (`DELETE /deleteLossClaim`): **Implemented via the trash icon** next to each claim.</li>
                    </ul>
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
                        onClick={() => router.push("/next-step")}
                        disabled={loading}
                    >
                        Continue to Next Step
                    </button>
                </div>
            </div>
            {/* RENDER MODAL HERE */}
            <AmendClaimModal />
        </StepLayout>
    );
}