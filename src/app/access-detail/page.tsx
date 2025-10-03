"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { useAppState } from "@/lib/state";
import { CheckCircleIcon, ExclamationCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function AccessDetailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const urlHmrcToken = params.get("token") || params.get("access_token");
  const { setToken, setHmrcToken, setNino } = useAppState();

  const [formData, setFormData] = useState({
    username: "junaidp@gmail.com",
    password: "Password1@",
    nino: "HG838408B"
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'auth' | 'hmrc' | 'complete' | 'nino'>('auth');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'nino' ? value.toUpperCase() : value
    }));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      console.log('Form submitted with data:', formData);
      
      // Validate inputs
      if (!formData.username || !formData.password || !formData.nino) {
        throw new Error("Please fill in all fields");
      }

      // Basic NINO validation
      const ninoRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D\s]?$/i;
      if (!ninoRegex.test(formData.nino)) {
        throw new Error("Please enter a valid NINO (e.g., QQ123456C)");
      }

      console.log('Making authentication request to backend...');
      
      try {
        // First authenticate with just username/password
        const res = await apiClient.post(
          "/api/user/authenticate", 
          {
            username: formData.username,
            password: formData.password
          },
          { auth: false }  // Explicitly disable auth for login request
        );
        
        console.log('Authentication response:', res);

        const token = (res.token || res.access_token || res.jwt || res.id_token) as string | undefined;
        if (!token) {
          console.error('No token found in response:', res);
          throw new Error("Authentication failed: No token received in response");
        }
        
        console.log('Authentication successful, token received');
        
        setToken(token);
        setNino(formData.nino);
        sessionStorage.setItem("authToken", token);
        sessionStorage.setItem("userNino", formData.nino);
        
        // If we have HMRC code, proceed to exchange token and then business details
        if (code) {
          console.log('Redirecting to business details with code:', code);
          try {
            await exchangeCodeForToken(code);
            router.push('/business-details');
          } catch (error) {
            console.error('Token exchange failed:', error);
            setError('Failed to complete HMRC authentication. Please try again.');
          }
        } else {
          console.log('Moving to HMRC step');
          setStep('hmrc');
        }
      } catch (apiError: any) {
        console.error('API Error:', apiError);
        if (apiError.response) {
          console.error('Response data:', await apiError.response.json());
          throw new Error(`API Error: ${apiError.response.status} - ${apiError.response.statusText}`);
        }
        throw apiError;
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const exchangeCodeForToken = async (code: string) => {
    try {
      setLoading(true);
      // Send code to backend's redirect endpoint
      const response = await apiClient.get(
          `/api/external/redirect?code=${encodeURIComponent(code)}`,
          // Ensure auth is false as this is the initial token request
      );

     // const { access_token: accessToken } = response;
      // Store the access token
      setHmrcToken(response);
      if (typeof window !== 'undefined') {
       // alert('setting:'+ response)
        sessionStorage.setItem('hmrcToken', response);
      }
      
      // Get business ID using the access token
      //const businessData = await apiClient.get('/getBusinessId');
      // Get business ID using the access token and NINO
     // const nino = formData.nino || (typeof window !== 'undefined' ? sessionStorage.getItem('userNino') : '');
      //if (!nino) throw new Error('NINO not found');

//     const businessData = await apiClient.get(`api/external/getBusinessId?nino=${nino}&token=${response}`);

      setBusinessId('');
      
      setStep('complete');
      router.push('/business-details');
      return response;
    } catch (err) {
      console.error('Error exchanging code for token:', err);
      setError('Failed to authenticate with HMRC. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Persist HMRC token and code if present in redirect
    if (urlHmrcToken) {
      setHmrcToken(urlHmrcToken);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("hmrcToken", urlHmrcToken);
      }
      setStep('hmrc');
    }
    
    // Store HMRC code in sessionStorage if present (will be used after login)
    if (code && !urlHmrcToken) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("hmrcCode", code);
      }
    }
  }, [code, urlHmrcToken, setHmrcToken]);

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">HMRC Tax Account Access</h2>
        <p className="mt-2 text-sm text-gray-600">
          Please provide your National Insurance Number to continue
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['Enter NINO', 'Complete'].map((stepText, index) => {
            const isActive = index === (step === 'nino' ? 0 : 1);
            const isCompleted = index < (step === 'nino' ? 0 : 1);
            
            return (
              <div key={index} className="flex flex-col items-center">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : isCompleted 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircleIcon className="h-6 w-6" />
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {stepText}
                </span>
                {index < 2 && (
                  <div className={`h-1 w-16 mt-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'auth' && (
        <form onSubmit={handleAuthSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your username"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nino" className="block text-sm font-medium text-gray-700">
              National Insurance Number
            </label>
            <div className="mt-1">
              <input
                id="nino"
                name="nino"
                type="text"
                required
                value={formData.nino}
                onChange={handleInputChange}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm uppercase"
                placeholder="e.g. QQ123456C"
                pattern="[A-Za-z]{2}[0-9]{6}[A-Za-z]?"
                title="Enter a valid NINO (e.g., QQ123456C)"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Format: QQ123456C</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Continue'}
              {!loading && <ArrowRightIcon className="ml-2 -mr-1 h-4 w-4" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
