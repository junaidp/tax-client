"use client";
import { useState, useEffect, useCallback } from "react";
import { StepLayout } from "@/components/StepLayout";
import { useAppState } from "@/lib/state";
import { useRouter } from "next/navigation";
import axios from "axios";
import {getOrGenerateAndPersistFraudHeaders} from "@/lib/fraudHeadersFrontend";

// --- Configuration ---
// The required API format for the tax year is YYYY-YY (e.g., 2024-25).
const getInitialTaxYear = () => {
  if (typeof window !== "undefined") {
    // Attempt to retrieve from sessionStorage first
    const storedTy = sessionStorage.getItem("taxYear");
    if (storedTy && storedTy.match(/^\d{4}-\d{2}$/)) {
      return storedTy;
    }
  }
  // Default to a recent tax year if none is stored or valid
  return "2024-25";
};

type SubmissionType = "selfEmployment" | "ukProperty" | "foreignProperty";

// --- Self-Employment Fields ---
const SE_ADJUSTMENT_FIELDS = [
  "includedNonTaxableProfits",
  "basisAdjustment",
  "overlapReliefUsed",
  "accountingAdjustment",
  "averagingAdjustment",
  "outstandingBusinessIncome",
  "balancingChargeBpra",
  "balancingChargeOther",
  "goodsAndServicesOwnUse",
];

const SE_ALLOWANCE_FIELDS = [
  "annualInvestmentAllowance",
  "capitalAllowanceMainPool",
  "capitalAllowanceSpecialRatePool",
  "zeroEmissionsGoodsVehicleAllowance",
  "businessPremisesRenovationAllowance",
  "enhancedCapitalAllowance",
  "allowanceOnSales",
  "capitalAllowanceSingleAssetPool",
  "electricChargePointAllowance",
  "zeroEmissionsCarAllowance",
  "tradingIncomeAllowance",
];

// --- UK Property Fields ---
const UKP_ADJUSTMENT_FIELDS = [
  "balancingCharge",
  "privateUseAdjustment",
  "businessPremisesRenovationAllowanceBalancingCharges",
];
// NOTE: nonResidentLandlord is a boolean field, handled separately in state and logic.

const UKP_ALLOWANCE_FIELDS = [
  "annualInvestmentAllowance",
  "businessPremisesRenovationAllowance",
  "otherCapitalAllowance",
  "costOfReplacingDomesticItems",
  "zeroEmissionsCarAllowance",
  "propertyIncomeAllowance", // Max 1000
];

// --- Foreign Property Types ---
type FPAdjustment = {
  privateUseAdjustment?: string;
  balancingCharge?: string;
}

type FPAllowance = {
  annualInvestmentAllowance?: string;
  costOfReplacingDomesticItems?: string;
  otherCapitalAllowance?: string;
  zeroEmissionsCarAllowance?: string;
  propertyIncomeAllowance?: string; // Max 1000
}

type FPAnnualEntry = {
  id: string; // Used for key/management
  countryCode: string;
  adjustments: FPAdjustment;
  allowances: FPAllowance;
};

export default function AnnualSubmissionPage() {
  const { nino, businessId, taxYear, setTaxYear, hmrcToken } = useAppState();
  const router = useRouter();

  // --- UI/Control States ---
  const [submissionType, setSubmissionType] = useState<SubmissionType>("selfEmployment");
  const [localTaxYear, setLocalTaxYear] = useState(taxYear || getInitialTaxYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- State for each section ---

  // Self-Employment States
  const [seAdjustments, setSeAdjustments] = useState<Record<string, string>>(() =>
      Object.fromEntries(SE_ADJUSTMENT_FIELDS.map(id => [id, ""]))
  );
  const [seAllowances, setSeAllowances] = useState<Record<string, string>>(() =>
      Object.fromEntries(SE_ALLOWANCE_FIELDS.map(id => [id, ""]))
  );
  const [seBusinessDetailsChangedRecently, setSeBusinessDetailsChangedRecently] = useState(false);
  const [seClass4NicsExemptionReason, setSeClass4NicsExemptionReason] = useState("");


  // UK Property States
  const [ukpAdjustments, setUkpAdjustments] = useState<Record<string, string>>(() =>
      Object.fromEntries(UKP_ADJUSTMENT_FIELDS.map(id => [id, ""]))
  );
  const [ukpAllowances, setUkpAllowances] = useState<Record<string, string>>(() =>
      Object.fromEntries(UKP_ALLOWANCE_FIELDS.map(id => [id, ""]))
  );
  // nonResidentLandlord state
  const [ukpNonResidentLandlord, setUkpNonResidentLandlord] = useState(false);
  // Rent A Room fields
  const [ukpRentARoomIncomeShared, setUkpRentARoomIncomeShared] = useState<string>("");
  const [ukpRentARoomJointlyLet, setUkpRentARoomJointlyLet] = useState(false);


  // Foreign Property States
  const [foreignProperties, setForeignProperties] = useState<FPAnnualEntry[]>([
    {
      id: Date.now().toString(),
      countryCode: "",
      adjustments: {},
      allowances: {},
    },
  ]);

  // --- Effects/Helpers ---

  const isValidTaxYearFormat = (ty: string) => {
    // Enforce YYYY-YY format
    return ty.match(/^\d{4}-\d{2}$/) !== null;
  };

  // Handler for all numerical inputs (Self-Employment & UK Property)
  const handleNumericalChange = useCallback((
      section: 'seAdjustments' | 'seAllowances' | 'ukpAdjustments' | 'ukpAllowances',
      field: string,
      value: string
  ) => {
    switch (section) {
      case 'seAdjustments':
        setSeAdjustments(prev => ({ ...prev, [field]: value }));
        break;
      case 'seAllowances':
        setSeAllowances(prev => ({ ...prev, [field]: value }));
        break;
      case 'ukpAdjustments':
        setUkpAdjustments(prev => ({ ...prev, [field]: value }));
        break;
      case 'ukpAllowances':
        setUkpAllowances(prev => ({ ...prev, [field]: value }));
        break;
    }
  }, []);

  // --- CORRECTED FOREIGN PROPERTY HANDLER ---
  const handleFPNumericalChange = useCallback((
      entryIndex: number,
      field: string, // The field key
      value: string,
      section: 'adjustments' | 'allowances' // The section name
  ) => {
    setForeignProperties(prev => {
      // Use functional update and create new array
      const newFPs = [...prev];
      const entryToUpdate = newFPs[entryIndex];

      // 1. Get the current section data, defaulting to an empty object if somehow undefined.
      // (Though initialized to {}, defensive coding here is good practice)
      const currentSectionData = (entryToUpdate[section] || {}) as Record<string, string>;

      // 2. Create a shallow copy of the section object with the new field value
      const newSectionData = {
        ...currentSectionData,
        [field]: value
      };

      // 3. Create a shallow copy of the entry with the updated section data
      newFPs[entryIndex] = {
        ...entryToUpdate,
        [section]: newSectionData,
      } as FPAnnualEntry;

      return newFPs;
    });
  }, []);
  // ------------------------------------------

  const buildSection = (entries: Record<string, string>) => {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(entries)) {
      const numValue = Number(value);
      if (value && !isNaN(numValue) && numValue !== 0) {
        // Special case for propertyIncomeAllowance (max 1000)
        if (key === 'propertyIncomeAllowance' && numValue > 1000) {
          result[key] = 1000;
        } else {
          result[key] = numValue;
        }
      }
    }
    return result;
  };

  // NEW RENDERER FUNCTION for consistency
  const renderAnnualInputField = (
      id: string,
      value: string,
      section: 'seAdjustments' | 'seAllowances' | 'ukpAdjustments' | 'ukpAllowances',
      label: string = id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) // Auto-generate label
  ) => {
    const isPIA = id === 'propertyIncomeAllowance';
    return (
        <div className="mb-2" key={id}>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>
            {label} <span className="text-gray-400 text-xs">({isPIA ? "Max £1000, optional" : "£, optional"})</span>
          </label>
          <input
              id={id}
              type="number"
              step="0.01"
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              value={value}
              onChange={(e) => handleNumericalChange(section, id, e.target.value)}
              min={isPIA ? "0" : undefined}
              max={isPIA ? "1000" : undefined}
          />
        </div>
    );
  };

  // --- CORRECTED FOREIGN PROPERTY RENDERER ---
  const renderFPInputField = (
      entryIndex: number,
      id: string, // The field ID (e.g., 'balancingCharge')
      value: string, // The current value (from state, or '')
      section: 'adjustments' | 'allowances',
      label: string = id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  ) => {
    const isPIA = id === 'propertyIncomeAllowance';
    return (
        <div className="mb-2" key={`${id}-${entryIndex}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${id}-${entryIndex}`}>
            {label} <span className="text-gray-400 text-xs">({isPIA ? "Max £1000, optional" : "£, optional"})</span>
          </label>
          <input
              id={`${id}-${entryIndex}`}
              type="number"
              step="0.01"
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              value={value}
              // Call handler with (index, fieldId, value, sectionName)
              onChange={(e) => handleFPNumericalChange(entryIndex, id, e.target.value, section)}
              min={isPIA ? "0" : undefined}
              max={isPIA ? "1000" : undefined}
          />
        </div>
    );
  };
  // ------------------------------------------


  // --- Submission Logic ---
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isValidTaxYearFormat(localTaxYear)) {
      setError("Please enter the Tax Year in the required YYYY-YY format (e.g., 2024-25).");
      setLoading(false);
      return;
    }

    try {
      const token =
          hmrcToken ||
          (typeof window !== "undefined" ? sessionStorage.getItem("hmrcToken") : "") ||
          "";
      const cleanTaxYear = localTaxYear;

      const params = new URLSearchParams({
        nino: nino || "",
        businessId: businessId || "",
        taxYear: cleanTaxYear,
        token,
      });

      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!baseUrl) {
        throw new Error("Backend base URL is not configured");
      }
      const headers = getOrGenerateAndPersistFraudHeaders();
      let endpoint = "";
      let requestBody: any = {};

      if (submissionType === "selfEmployment") {
        endpoint = "/api/external/createAndAmendSelfEmploymentSubmissionAnnual";
        const finalAdjustments = buildSection(seAdjustments);
        const finalAllowances = buildSection(seAllowances);

        requestBody.nonFinancials = {
          businessDetailsChangedRecently: seBusinessDetailsChangedRecently,
          ...(seClass4NicsExemptionReason ? { class4NicsExemptionReason: seClass4NicsExemptionReason } : {}),
        };
        if (Object.keys(finalAdjustments).length > 0) requestBody.adjustments = finalAdjustments;
        if (Object.keys(finalAllowances).length > 0) requestBody.allowances = finalAllowances;

      } else if (submissionType === "ukProperty") {
        endpoint = "/api/external/createAndAmendUKPropertyAnnual";

        const finalUkpAdjustments = buildSection(ukpAdjustments);
        const finalUkpAllowances = buildSection(ukpAllowances);

        // --- UK Property Body Construction (UPDATED for duplication) ---

        const adjustedUkpAdjustments = { ...finalUkpAdjustments };
        if (ukpNonResidentLandlord) {
          // DUPLICATE/ADD nonResidentLandlord to the adjustments object as requested
          (adjustedUkpAdjustments as any).nonResidentLandlord = ukpNonResidentLandlord;
        }

        requestBody.ukProperty = {
          adjustments: adjustedUkpAdjustments,
          allowances: finalUkpAllowances,
          // nonResidentLandlord is STILL placed as a sibling to adjustments/allowances (Default/Standard API Structure)
          nonResidentLandlord: ukpNonResidentLandlord,
        };

        if (ukpRentARoomIncomeShared || ukpRentARoomJointlyLet) {
          // Only include the rentARoom object if data is provided, but 'jointlyLet' is a required boolean within it.
          const rentARoomBody = {
            // incomeShared is numerical, only include if there is a value
            ...(ukpRentARoomIncomeShared && Number(ukpRentARoomIncomeShared) !== 0 ? { incomeShared: Number(ukpRentARoomIncomeShared) } : {}),
            jointlyLet: ukpRentARoomJointlyLet, // Use the state boolean value
          };
          // Only attach if we have *something* to send in the object (either incomeShared or jointlyLet)
          if (Object.keys(rentARoomBody).length > 0) {
            requestBody.ukProperty.rentARoom = rentARoomBody;
          }
        }
        // --- END UK Property Body Construction (UPDATED) ---

      } else { // foreignProperty
        endpoint = "/api/external/createAndAmendForeignPropertyAnnual";

        const fpArray = foreignProperties
            .filter(fp => fp.countryCode) // Must have a country code
            .map(fp => {
              // Safely convert adjustments/allowances string records to number records
              const finalAdjustments = buildSection(fp.adjustments as Record<string, string>);
              const finalAllowances = buildSection(fp.allowances as Record<string, string>);

              return {
                countryCode: fp.countryCode,
                adjustments: finalAdjustments,
                allowances: finalAllowances,
                // structuredBuildingAllowance omitted
              };
            }).filter(fp =>
                // Only send entries that contain actual data (adjustments or allowances)
                Object.keys(fp.adjustments).length > 0 || Object.keys(fp.allowances).length > 0
            );

        if (fpArray.length === 0) {
          // Check if user has any entries, and if so, if they provided a country code/values
          if(foreignProperties.length > 0) {
            throw new Error("Foreign Property submission requires at least one entry with a Country Code and data (adjustments/allowances).");
          }
        }

        requestBody.foreignProperty = fpArray;
      }

      // Clean up body (remove empty objects/arrays before sending)
      const cleanBody = JSON.parse(JSON.stringify(requestBody, (key, value) => {
        if (value === null || value === undefined || (typeof value === 'object' && Object.keys(value).length === 0)) {
          return undefined;
        }
        return value;
      }));

      if (Object.keys(cleanBody).length === 0) {
        throw new Error("No data entered for submission.");
      }

      await axios.put(
          `${baseUrl}${endpoint}?${params.toString()}`,
          cleanBody,
          {
            headers
          }
      );

      setTaxYear(cleanTaxYear);
      router.push("/bsas-trigger");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit annual submission");
    } finally {
      setLoading(false);
    }
  };


  // --- Render Components based on Tab ---

  const renderSelfEmploymentTab = () => (
      <>
        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Adjustments</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {SE_ADJUSTMENT_FIELDS.map(id => renderAnnualInputField(
                id,
                seAdjustments[id],
                'seAdjustments'
            ))}
          </div>
        </details>

        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Allowances</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {SE_ALLOWANCE_FIELDS.map(id => renderAnnualInputField(
                id,
                seAllowances[id],
                'seAllowances'
            ))}
          </div>
        </details>

        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="font-semibold text-lg">Non-Financials</h3>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                  id="seBusinessDetailsChangedRecently"
                  type="checkbox"
                  checked={seBusinessDetailsChangedRecently}
                  onChange={(e) => setSeBusinessDetailsChangedRecently(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  // The non-financials object is optional, but if included, this field is defined as required in the API spec
              />
              <span className="text-sm font-medium text-gray-700">
              Business details changed recently
            </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seClass4NicsExemptionReason">
              Class 4 NICs Exemption Reason
            </label>
            <select
                id="seClass4NicsExemptionReason"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={seClass4NicsExemptionReason}
                onChange={(e) => setSeClass4NicsExemptionReason(e.target.value)}
            >
              <option value="">-- Select reason (optional) --</option>
              <option value="non-resident">Non-resident</option>
              <option value="trustee">Trustee</option>
              <option value="diver">Diver</option>
              <option value="ITTOIA-2005">ITTOIA-2005</option>
              <option value="over-state-pension-age">Over state pension age</option>
              <option value="under-16">Under 16</option>
            </select>
          </div>
        </div>
      </>
  );

  // UK Property Tab
  const renderUKPropertyTab = () => (
      <>
        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Adjustments</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {UKP_ADJUSTMENT_FIELDS.map(id => renderAnnualInputField(
                id,
                ukpAdjustments[id],
                'ukpAdjustments'
            ))}

            {/* nonResidentLandlord (UI placed here) */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                    id="ukpNonResidentLandlord"
                    type="checkbox"
                    checked={ukpNonResidentLandlord}
                    onChange={(e) => setUkpNonResidentLandlord(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                Non-Resident Landlord (If checked, sent in multiple locations in API payload)
                </span>
              </label>
            </div>

            {/* Rent A Room Income Shared (Numerical) */}
            {renderAnnualInputField("ukpRentARoomIncomeShared", ukpRentARoomIncomeShared, 'ukpAdjustments', "Rent A Room Income Shared (£, optional)")}

            {/* Rent A Room Jointly Let (Boolean) */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                    id="ukpRentARoomJointlyLet"
                    type="checkbox"
                    checked={ukpRentARoomJointlyLet}
                    onChange={(e) => setUkpRentARoomJointlyLet(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                Rent A Room Jointly Let (Part of optional `rentARoom` object)
                </span>
              </label>
            </div>

          </div>
        </details>

        <details className="bg-white p-6 rounded-lg shadow-md border" open>
          <summary className="cursor-pointer font-semibold text-lg text-gray-800">Allowances</summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {UKP_ALLOWANCE_FIELDS.map(id => renderAnnualInputField(
                id,
                ukpAllowances[id],
                'ukpAllowances'
            ))}
          </div>
        </details>
      </>
  );

  const renderForeignPropertyTab = () => (
      <>
        {foreignProperties.map((entry, idx) => (
            <div key={entry.id} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <h3 className="font-semibold text-lg">Foreign Property Entry #{idx + 1}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Code (ISO 3166-1 alpha-3)</label>
                  <input
                      type="text"
                      className="w-full p-2 border rounded-md"
                      value={entry.countryCode || ""}
                      onChange={(e) => {
                        const copy = [...foreignProperties];
                        copy[idx].countryCode = e.target.value.toUpperCase();
                        setForeignProperties(copy);
                      }}
                      placeholder="e.g. FRA"
                      // Required attribute only necessary for submission check, removed here for better user experience
                  />
                </div>
                <div>{/* Placeholder for alignment */}</div>
              </div>

              <details className="border rounded p-3" open>
                <summary className="cursor-pointer font-medium text-gray-800">Adjustments</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFPInputField(
                      idx,
                      'privateUseAdjustment', // Field ID
                      entry.adjustments.privateUseAdjustment ?? "", // Current Value (safely accessed)
                      'adjustments',
                      "Private Use Adjustment"
                  )}
                  {renderFPInputField(
                      idx,
                      'balancingCharge', // Field ID
                      entry.adjustments.balancingCharge ?? "", // Current Value (safely accessed)
                      'adjustments',
                      "Balancing Charge"
                  )}
                </div>
              </details>

              <details className="border rounded p-3" open>
                <summary className="cursor-pointer font-medium text-gray-800">Allowances</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFPInputField(
                      idx,
                      'annualInvestmentAllowance', // Field ID
                      entry.allowances.annualInvestmentAllowance ?? "", // Current Value
                      'allowances',
                      "Annual Investment Allowance"
                  )}
                  {renderFPInputField(
                      idx,
                      'costOfReplacingDomesticItems', // Field ID
                      entry.allowances.costOfReplacingDomesticItems ?? "", // Current Value
                      'allowances',
                      "Cost Of Replacing Domestic Items"
                  )}
                  {renderFPInputField(
                      idx,
                      'otherCapitalAllowance', // Field ID
                      entry.allowances.otherCapitalAllowance ?? "", // Current Value
                      'allowances',
                      "Other Capital Allowance"
                  )}
                  {renderFPInputField(
                      idx,
                      'zeroEmissionsCarAllowance', // Field ID
                      entry.allowances.zeroEmissionsCarAllowance ?? "", // Current Value
                      'allowances',
                      "Zero Emissions Car Allowance"
                  )}
                  {renderFPInputField(
                      idx,
                      'propertyIncomeAllowance', // Field ID
                      entry.allowances.propertyIncomeAllowance ?? "", // Current Value
                      'allowances',
                      "Property Income Allowance"
                  )}
                  <div>{/* Placeholder for alignment */}</div>
                </div>
              </details>

              <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                    disabled={foreignProperties.length === 1}
                    onClick={() => setForeignProperties(prev => prev.filter((_, i) => i !== idx))}
                >
                  Remove Entry
                </button>
              </div>
            </div>
        ))}
        <button
            type="button"
            onClick={() => setForeignProperties(prev => [
              ...prev,
              { id: Date.now().toString(), countryCode: "", adjustments: {}, allowances: {} }
            ])}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >
          + Add Another Foreign Property Entry
        </button>
      </>
  );

  return (
      <StepLayout title="Step 16: Annual Submission" backHref="/period-summary" next={null}>
        <form onSubmit={onSubmit} className="space-y-6 max-w-4xl mx-auto">

          {/* Tax Year Panel */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="font-semibold mb-3 text-lg">Select Tax Year</p>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taxYearInput">
                Tax Year (YYYY-YY)
              </label>
              <input
                  id="taxYearInput"
                  type="text"
                  className={`w-full p-2 border rounded-md ${!isValidTaxYearFormat(localTaxYear) && localTaxYear.length > 0 ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="e.g. 2024-25"
                  value={localTaxYear}
                  onChange={(e) => setLocalTaxYear(e.target.value.trim())}
                  maxLength={7}
                  required
              />
              {!isValidTaxYearFormat(localTaxYear) && localTaxYear.length > 0 && (
                  <p className="text-red-500 text-xs mt-1">Format must be YYYY-YY (e.g., 2024-25)</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
                onClick={() => setSubmissionType("selfEmployment")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "selfEmployment"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              Self-Employment
            </button>
            <button
                onClick={() => setSubmissionType("ukProperty")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "ukProperty"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              UK Property
            </button>
            <button
                onClick={() => setSubmissionType("foreignProperty")}
                type="button"
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                    submissionType === "foreignProperty"
                        ? "bg-white border-blue-600 text-blue-600 font-semibold"
                        : "bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200"
                }`}
            >
              Foreign Property
            </button>
          </div>

          {/* Tab Content */}
          {submissionType === "selfEmployment" && renderSelfEmploymentTab()}
          {submissionType === "ukProperty" && renderUKPropertyTab()}
          {submissionType === "foreignProperty" && renderForeignPropertyTab()}

          {error && <div className="text-red-500 text-sm mt-2 p-3 border border-red-300 bg-red-50 rounded">{error}</div>}

          <div className="flex justify-end pt-4">
            <button
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                type="submit"
                disabled={loading || !isValidTaxYearFormat(localTaxYear)}
            >
              {loading ? "Submitting..." : "Next"}
            </button>
          </div>
        </form>
      </StepLayout>
  );
}