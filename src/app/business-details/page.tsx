"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppState } from "@/lib/state";
import axios from "axios";
import { withFraudHeaders, hmrcGet } from "@/lib/withFraudHeaders";
import {generateFraudHeaders, getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
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
}

export default function BusinessDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setBusinessId } = useAppState();
  const [nino, setNino] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hmrcToken, setHmrcToken] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
      null
  );

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

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setBusinessId(business.id);
  };

  const handleContinue = () => {
    if (selectedBusiness) {
      router.push("/obligations");
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
              Let's find your business records. Enter your National Insurance
              Number to get started.
            </p>
          </div>

          <div className="bg-white shadow-xl rounded-2xl overflow-hidden mb-8">
            <div className="p-8">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  {hmrcToken && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    HMRC Connected
                  </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                        htmlFor="nino"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      National Insurance Number
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <div className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-700 sm:text-sm">
                        {nino || "Loading..."}
                      </div>
                      <button
                          onClick={fetchBusinesses}
                          disabled={loading || !nino.trim()}
                          className={`inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 text-sm font-medium rounded-r-md ${
                              loading || !nino.trim()
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          }`}
                      >
                        {loading ? (
                            <>
                              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                              Searching...
                            </>
                        ) : (
                            "Search"
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Retrieved from your login session.
                    </p>
                  </div>
                </div>
              </div>

              {businesses.length > 0 && (
                  <div className="mt-10">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {businesses.length}{" "}
                      {businesses.length === 1
                          ? "Business Found"
                          : "Businesses Found"}
                    </h3>
                    <div className="space-y-4">
                      {businesses.map((business) => (
                          <div
                              key={business.id}
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
                                <div className="mt-3 flex flex-wrap gap-2">
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
                      ))}
                    </div>
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
