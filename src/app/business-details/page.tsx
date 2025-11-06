"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state";
import axios from "axios";
import { withFraudHeaders, hmrcGet } from "@/lib/withFraudHeaders";
import {generateFraudHeaders, getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

interface Business {
  id: string;
  name: string;
  type: string;
  address?: string;
  taxYear?: string;
  accountingPeriod?: string;
  businessId?: string;
  links?: any[];
  details?: any; // Store fetched details
  detailsLoading?: boolean; // Loading state for details
  detailsExpanded?: boolean; // Expansion state
  amendExpanded?: boolean; // Amend section expansion state
}

export default function BusinessDetails() {
  const router = useRouter();
  const { setBusinessId } = useAppState();
  const [nino, setNino] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true); // Changed to true initially
  const [error, setError] = useState("");
  const [hmrcToken, setHmrcToken] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
      null
  );
  const [amendingQuarterly, setAmendingQuarterly] = useState<{[key: string]: boolean}>({});
  const [quarterlyPeriodType, setQuarterlyPeriodType] = useState<{[key: string]: string}>({});
  const [taxYearInput, setTaxYearInput] = useState<{[key: string]: string}>({});

  // Load HMRC token from sessionStorage (already saved during OAuth)
  useEffect(() => {
    const tokenFromStorage =
        typeof window !== "undefined"
            ? sessionStorage.getItem("hmrcToken")
            : null;
    if (tokenFromStorage) {
      setHmrcToken(tokenFromStorage);
    }
  }, []);

  // Load NINO from sessionStorage (already saved during login)
  useEffect(() => {
    const savedNino =
        typeof window !== "undefined" ? sessionStorage.getItem("userNino") : null;
    if (savedNino) {
      setNino(savedNino);
    }
  }, []);

  const fetchBusinesses = async () => {
    const currentNino =
        typeof window !== "undefined" ? sessionStorage.getItem("userNino") : null;

    if (!currentNino) {
      setError(
          "National Insurance Number not found. Please go back and log in again."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSelectedBusiness(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error('Backend base URL is not configured');
      }
      const headers = getOrGenerateAndPersistFraudHeaders();
      const response = await axios.get(`${baseUrl}/api/external/getBusinessId`, {
        params: { nino: currentNino, token: hmrcToken },
        headers,
      });

      const raw = response.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      const businessesData: Business[] = (parsed?.listOfBusinesses ?? []).map(
          (business: any) => ({
            id: business.businessId,
            name: business.tradingName,
            type: business.typeOfBusiness,
            businessId: business.businessId,
            links: business.links,
            address: undefined,
            taxYear: undefined,
            accountingPeriod: undefined,
          })
      );

      console.log("Parsed response:", parsed);
      console.log("Businesses data:", businessesData);
      setBusinesses(businessesData);
    } catch (err) {
      console.error("Error fetching businesses:", err);
      setError(
          "Failed to fetch business details. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch businesses when component mounts and we have both nino and hmrcToken
  useEffect(() => {
    if (nino && hmrcToken) {
      fetchBusinesses();
    }
  }, [nino, hmrcToken]); // Trigger when both are available

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setBusinessId(business.id);
  };

  const handleShowDetails = async (business: Business, index: number) => {
    // If already expanded, just collapse it
    if (business.detailsExpanded) {
      setBusinesses(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          detailsExpanded: false,
        };
        return updated;
      });
      return;
    }

    // If details already fetched, just expand
    if (business.details) {
      setBusinesses(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          detailsExpanded: true,
        };
        return updated;
      });
      return;
    }

    // Set loading state
    setBusinesses(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        detailsLoading: true,
        detailsExpanded: true,
      };
      return updated;
    });

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error('Backend base URL is not configured');
      }

      console.log('Fetching business details with params:', {
        nino: nino,
        token: hmrcToken ? 'Present' : 'Missing',
        businessId: business.businessId
      });

      const headers = getOrGenerateAndPersistFraudHeaders();
      const response = await axios.get(`${baseUrl}/api/external/getBusinessDetail`, {
        params: {
          nino: nino,
          token: hmrcToken,
          businessId: business.businessId
        },
        headers,
      });

      console.log('Raw response:', response);
      console.log('Response data:', response.data);

      const raw = response.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      console.log('Parsed business details:', parsed);

      // Update state properly to trigger re-render
      setBusinesses(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          details: parsed,
          detailsLoading: false,
          detailsExpanded: true,
        };
        console.log('Updated businesses state:', updated);
        return updated;
      });

    } catch (err: any) {
      console.error("Error fetching business details:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);

      setBusinesses(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          detailsLoading: false,
          detailsExpanded: false,
        };
        return updated;
      });

      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch business details";
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleContinue = () => {
    if (selectedBusiness) {
      router.push("/obligations");
    }
  };

  const handleAmendQuarterlyPeriod = async (businessId: string, businessIndex: number) => {
    const periodType = quarterlyPeriodType[businessId];
    const taxYear = taxYearInput[businessId];

    if (!periodType) {
      alert("Please select a quarterly period type (Standard or Calendar)");
      return;
    }

    if (!taxYear) {
      alert("Please enter a tax year");
      return;
    }

    setAmendingQuarterly(prev => ({ ...prev, [businessId]: true }));

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error('Backend base URL is not configured');
      }

      const requestBody = {
        quarterlyPeriodType: periodType
      };

      console.log('Amending quarterly period with:', {
        nino,
        businessId,
        taxYear,
        body: requestBody,

      });

      const fraudHeaders = getOrGenerateAndPersistFraudHeaders();

      // Try sending as string since backend might expect it that way
      const response = await axios.put(
          `${baseUrl}/api/external/createAmendQuarterlyPeriod`,
          requestBody,
          {
            params: {
              nino: nino,
              token: hmrcToken,
              businessId: businessId,
              taxYear: taxYear
            },
            headers: {
              ...fraudHeaders,
              'Content-Type': 'application/json',
            },
          }
      );

      console.log('Amendment response:', response.data);
      alert(`Successfully amended quarterly period to ${periodType} for tax year ${taxYear}`);

      // Refresh business details to show updated information
      const business = businesses[businessIndex];
      setBusinesses(prev => {
        const updated = [...prev];
        updated[businessIndex] = {
          ...updated[businessIndex],
          details: undefined, // Clear cached details
          detailsExpanded: false,
          amendExpanded: false,
        };
        return updated;
      });

      // Re-fetch details if it was expanded
      if (business.detailsExpanded) {
        handleShowDetails(business, businessIndex);
      }

    } catch (err: any) {
      console.error("Error amending quarterly period:", err);
      console.error("Error response:", err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || "Failed to amend quarterly period";
      alert(`Error: ${errorMessage}`);
    } finally {
      setAmendingQuarterly(prev => ({ ...prev, [businessId]: false }));
    }
  };

  const handleToggleAmendSection = (business: Business, index: number) => {
    setBusinesses(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        amendExpanded: !updated[index].amendExpanded,
      };
      return updated;
    });

    // Initialize tax year input if not already set
    if (!taxYearInput[business.businessId || ''] && business.details?.quarterlyTypeChoice?.taxYearOfChoice) {
      setTaxYearInput(prev => ({
        ...prev,
        [business.businessId || '']: business.details.quarterlyTypeChoice.taxYearOfChoice
      }));
    }
  };

  return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
              Your Business Details
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">

            </p>
          </div>

          <div className="bg-white shadow-xl rounded-2xl overflow-hidden mb-8">
            <div className="p-8">
              {/* Show HMRC Connected Badge */}
              {hmrcToken && (
                  <div className="mb-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      HMRC Connected
                    </span>
                  </div>
              )}

              {/* Loading State */}
              {loading && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ArrowPathIcon className="animate-spin h-12 w-12 text-blue-600 mb-4" />
                    <p className="text-gray-600">Fetching your business details...</p>
                  </div>
              )}

              {/* Error State */}
              {error && !loading && (
                  <div className="rounded-md bg-red-50 p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                      </div>
                    </div>
                  </div>
              )}

              {/* Businesses List */}
              {businesses.length > 0 && !loading && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {businesses.length}{" "}
                      {businesses.length === 1
                          ? "Business Found"
                          : "Businesses Found"}
                    </h3>
                    <div className="space-y-4">
                      {businesses.map((business, index) => (
                          <div key={business.id}>
                            <div
                                onClick={() => handleSelectBusiness(business)}
                                className={`border rounded-lg p-5 cursor-pointer transition-all duration-200 ${
                                    selectedBusiness?.id === business.id
                                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                }`}
                            >
                              <div className="flex items-start">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="ml-4 flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-semibold text-gray-900">
                                      {business.name}
                                    </h4>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      {business.type}
                                    </span>
                                  </div>
                                  {business.address && (
                                      <p className="mt-1 text-sm text-gray-600">
                                        {business.address}
                                      </p>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                                    {business.taxYear && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          Tax Year: {business.taxYear}
                                        </span>
                                    )}
                                    {business.accountingPeriod && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {business.accountingPeriod}
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShowDetails(business, index);
                                        }}
                                        className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                    >
                                      <InformationCircleIcon className="h-4 w-4 mr-1" />
                                      {business.detailsExpanded ? "Hide Details" : "Show Business Details"}
                                      {business.detailsExpanded ? (
                                          <ChevronUpIcon className="h-3 w-3 ml-1" />
                                      ) : (
                                          <ChevronDownIcon className="h-3 w-3 ml-1" />
                                      )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleAmendSection(business, index);
                                        }}
                                        className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                                    >
                                      <PencilSquareIcon className="h-4 w-4 mr-1" />
                                      {business.amendExpanded ? "Hide Amend" : "Amend Quarterly Period"}
                                      {business.amendExpanded ? (
                                          <ChevronUpIcon className="h-3 w-3 ml-1" />
                                      ) : (
                                          <ChevronDownIcon className="h-3 w-3 ml-1" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  <div
                                      className={`h-5 w-5 rounded-full flex items-center justify-center ${
                                          selectedBusiness?.id === business.id
                                              ? "bg-blue-600"
                                              : "border-2 border-gray-300"
                                      }`}
                                  >
                                    {selectedBusiness?.id === business.id && (
                                        <svg
                                            className="h-3 w-3 text-white"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                          <path
                                              fillRule="evenodd"
                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                              clipRule="evenodd"
                                          />
                                        </svg>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Collapsible Amend Section */}
                            {business.amendExpanded && (
                                <div className="mt-2 border border-green-200 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden shadow-sm">
                                  <div className="p-6">
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 p-6">
                                      <h6 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                                        <PencilSquareIcon className="h-5 w-5 mr-2 text-green-600" />
                                        Amend Quarterly Period
                                      </h6>

                                      <div className="space-y-4">
                                        {/* Tax Year Input */}
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Tax Year
                                          </label>
                                          <input
                                              type="text"
                                              value={taxYearInput[business.businessId || ''] || business.details?.quarterlyTypeChoice?.taxYearOfChoice || ''}
                                              onChange={(e) => setTaxYearInput(prev => ({
                                                ...prev,
                                                [business.businessId || '']: e.target.value
                                              }))}
                                              placeholder="e.g., 2022-23"
                                              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                          />
                                          <p className="mt-1 text-xs text-gray-500">Format: YYYY-YY (e.g., 2022-23)</p>
                                        </div>

                                        {/* Period Type Selection */}
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Select Quarterly Period Type
                                          </label>
                                          <div className="grid grid-cols-2 gap-4">
                                            {/* Standard Option */}
                                            <div
                                                onClick={() => setQuarterlyPeriodType(prev => ({
                                                  ...prev,
                                                  [business.businessId || '']: 'standard'
                                                }))}
                                                className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                                                    quarterlyPeriodType[business.businessId || ''] === 'standard'
                                                        ? 'border-green-600 bg-green-50 ring-2 ring-green-200'
                                                        : 'border-gray-300 bg-white hover:border-green-300'
                                                }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                                      quarterlyPeriodType[business.businessId || ''] === 'standard'
                                                          ? 'border-green-600 bg-green-600'
                                                          : 'border-gray-300'
                                                  }`}>
                                                    {quarterlyPeriodType[business.businessId || ''] === 'standard' && (
                                                        <div className="h-2 w-2 rounded-full bg-white"></div>
                                                    )}
                                                  </div>
                                                  <span className={`ml-3 text-sm font-medium ${
                                                      quarterlyPeriodType[business.businessId || ''] === 'standard'
                                                          ? 'text-green-900'
                                                          : 'text-gray-900'
                                                  }`}>
                                                    Standard
                                                  </span>
                                                </div>
                                              </div>
                                              <p className="mt-2 text-xs text-gray-600">
                                                Traditional quarterly reporting periods
                                              </p>
                                            </div>

                                            {/* Calendar Option */}
                                            <div
                                                onClick={() => setQuarterlyPeriodType(prev => ({
                                                  ...prev,
                                                  [business.businessId || '']: 'calendar'
                                                }))}
                                                className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                                                    quarterlyPeriodType[business.businessId || ''] === 'calendar'
                                                        ? 'border-green-600 bg-green-50 ring-2 ring-green-200'
                                                        : 'border-gray-300 bg-white hover:border-green-300'
                                                }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                                      quarterlyPeriodType[business.businessId || ''] === 'calendar'
                                                          ? 'border-green-600 bg-green-600'
                                                          : 'border-gray-300'
                                                  }`}>
                                                    {quarterlyPeriodType[business.businessId || ''] === 'calendar' && (
                                                        <div className="h-2 w-2 rounded-full bg-white"></div>
                                                    )}
                                                  </div>
                                                  <span className={`ml-3 text-sm font-medium ${
                                                      quarterlyPeriodType[business.businessId || ''] === 'calendar'
                                                          ? 'text-green-900'
                                                          : 'text-gray-900'
                                                  }`}>
                                                    Calendar
                                                  </span>
                                                </div>
                                              </div>
                                              <p className="mt-2 text-xs text-gray-600">
                                                Calendar year quarterly periods
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Submit Button */}
                                        <div className="pt-4">
                                          <button
                                              onClick={() => handleAmendQuarterlyPeriod(business.businessId || '', index)}
                                              disabled={amendingQuarterly[business.businessId || '']}
                                              className={`w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                                                  amendingQuarterly[business.businessId || '']
                                                      ? 'bg-gray-400 cursor-not-allowed'
                                                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                                              }`}
                                          >
                                            {amendingQuarterly[business.businessId || ''] ? (
                                                <>
                                                  <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                                  Submitting...
                                                </>
                                            ) : (
                                                <>
                                                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                                                  Submit Amendment
                                                </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            )}

                            {/* Collapsible Details Section */}
                            {business.detailsExpanded && (
                                <div className="mt-2 border border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white overflow-hidden shadow-sm">
                                  {business.detailsLoading ? (
                                      <div className="p-6 flex items-center justify-center">
                                        <ArrowPathIcon className="animate-spin h-6 w-6 text-blue-600 mr-2" />
                                        <span className="text-gray-600">Loading business details...</span>
                                      </div>
                                  ) : business.details ? (
                                      <div className="p-6">
                                        <h5 className="text-base font-semibold text-gray-900 mb-4 flex items-center border-b border-gray-200 pb-3">
                                          <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
                                          Complete Business Information
                                        </h5>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          {/* Basic Information */}
                                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                                            <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Basic Information</h6>
                                            <div className="space-y-2">
                                              {business.details.businessId && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Business ID:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.businessId}</span>
                                                  </div>
                                              )}
                                              {business.details.tradingName && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Trading Name:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.tradingName}</span>
                                                  </div>
                                              )}
                                              {business.details.typeOfBusiness && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Type:</span>
                                                    <span className="text-sm font-medium text-gray-900 capitalize">{business.details.typeOfBusiness.replace('-', ' ')}</span>
                                                  </div>
                                              )}
                                              {business.details.accountingType && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Accounting Type:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.accountingType}</span>
                                                  </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Dates */}
                                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                                            <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Important Dates</h6>
                                            <div className="space-y-2">
                                              {business.details.commencementDate && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Commencement:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.commencementDate}</span>
                                                  </div>
                                              )}
                                              {business.details.cessationDate && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">Cessation:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.cessationDate}</span>
                                                  </div>
                                              )}
                                              {business.details.firstAccountingPeriodStartDate && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">First Period Start:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.firstAccountingPeriodStartDate}</span>
                                                  </div>
                                              )}
                                              {business.details.firstAccountingPeriodEndDate && (
                                                  <div className="flex justify-between py-1">
                                                    <span className="text-sm text-gray-600">First Period End:</span>
                                                    <span className="text-sm font-medium text-gray-900">{business.details.firstAccountingPeriodEndDate}</span>
                                                  </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Address */}
                                          {(business.details.businessAddressLineOne || business.details.businessAddressPostcode) && (
                                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Business Address</h6>
                                                <div className="space-y-1 text-sm text-gray-900">
                                                  {business.details.businessAddressLineOne && <div>{business.details.businessAddressLineOne}</div>}
                                                  {business.details.businessAddressLineTwo && <div>{business.details.businessAddressLineTwo}</div>}
                                                  {business.details.businessAddressLineThree && <div>{business.details.businessAddressLineThree}</div>}
                                                  {business.details.businessAddressLineFour && <div>{business.details.businessAddressLineFour}</div>}
                                                  {business.details.businessAddressPostcode && (
                                                      <div className="font-medium pt-1">{business.details.businessAddressPostcode}</div>
                                                  )}
                                                  {business.details.businessAddressCountryCode && (
                                                      <div className="text-gray-600">{business.details.businessAddressCountryCode}</div>
                                                  )}
                                                </div>
                                              </div>
                                          )}

                                          {/* Accounting Periods */}
                                          {business.details.accountingPeriods && business.details.accountingPeriods.length > 0 && (
                                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Accounting Periods</h6>
                                                <div className="space-y-2">
                                                  {business.details.accountingPeriods.map((period: any, idx: number) => (
                                                      <div key={idx} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                                                        <span className="text-sm text-gray-600">Period {idx + 1}:</span>
                                                        <span className="text-sm font-medium text-gray-900">
                                                      {period.start} to {period.end}
                                                    </span>
                                                      </div>
                                                  ))}
                                                </div>
                                              </div>
                                          )}

                                          {/* Latency Details */}
                                          {business.details.latencyDetails && (
                                              <div className="bg-white rounded-lg border border-gray-200 p-4 md:col-span-2">
                                                <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Latency Information</h6>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                  {business.details.latencyDetails.latencyEndDate && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">End Date</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.latencyDetails.latencyEndDate}</span>
                                                      </div>
                                                  )}
                                                  {business.details.latencyDetails.taxYear1 && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Tax Year 1</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.latencyDetails.taxYear1}</span>
                                                      </div>
                                                  )}
                                                  {business.details.latencyDetails.latencyIndicator1 && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Indicator 1</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.latencyDetails.latencyIndicator1}</span>
                                                      </div>
                                                  )}
                                                  {business.details.latencyDetails.taxYear2 && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Tax Year 2</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.latencyDetails.taxYear2}</span>
                                                      </div>
                                                  )}
                                                  {business.details.latencyDetails.latencyIndicator2 && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Indicator 2</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.latencyDetails.latencyIndicator2}</span>
                                                      </div>
                                                  )}
                                                </div>
                                              </div>
                                          )}

                                          {/* Additional Info */}
                                          {(business.details.yearOfMigration || business.details.quarterlyTypeChoice) && (
                                              <div className="bg-white rounded-lg border border-gray-200 p-4 md:col-span-2">
                                                <h6 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Additional Information</h6>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                  {business.details.yearOfMigration && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Year of Migration</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.yearOfMigration}</span>
                                                      </div>
                                                  )}
                                                  {business.details.quarterlyTypeChoice?.quarterlyPeriodType && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Quarterly Period Type</span>
                                                        <span className="text-sm font-medium text-gray-900 capitalize">{business.details.quarterlyTypeChoice.quarterlyPeriodType}</span>
                                                      </div>
                                                  )}
                                                  {business.details.quarterlyTypeChoice?.taxYearOfChoice && (
                                                      <div>
                                                        <span className="text-xs text-gray-500 block">Tax Year of Choice</span>
                                                        <span className="text-sm font-medium text-gray-900">{business.details.quarterlyTypeChoice.taxYearOfChoice}</span>
                                                      </div>
                                                  )}
                                                </div>
                                              </div>
                                          )}
                                        </div>

                                        {/* Raw JSON Toggle (for debugging) */}
                                        <details className="mt-6">
                                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium">
                                            View Raw Data (JSON)
                                          </summary>
                                          <div className="mt-3 bg-gray-900 rounded-md p-4 overflow-x-auto">
                                            <pre className="text-xs text-green-400 whitespace-pre-wrap">
                                              {JSON.stringify(business.details, null, 2)}
                                            </pre>
                                          </div>
                                        </details>
                                      </div>
                                  ) : (
                                      <div className="p-6 text-center text-gray-500">
                                        No details available
                                      </div>
                                  )}
                                </div>
                            )}
                          </div>
                      ))}
                    </div>
                  </div>
              )}

              {/* No Results State */}
              {businesses.length === 0 && !loading && !error && (
                  <div className="text-center py-12">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No businesses found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No business records were found for this account.
                    </p>
                  </div>
              )}
            </div>

            <div className="bg-gray-50 px-8 py-5 border-t border-gray-200 flex justify-between items-center">
              <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back
              </button>
              <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selectedBusiness}
                  className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                      selectedBusiness
                          ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          : "bg-gray-300 cursor-not-allowed"
                  }`}
              >
                Continue to Tax Obligations
                <ArrowRightIcon className="ml-2 -mr-1 h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>
              Can't find your business? Contact HMRC for assistance with your
              business records.
            </p>
          </div>
        </div>
      </div>
  );
}