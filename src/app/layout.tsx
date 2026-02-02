import "./globals.css";
import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import { StateProvider } from "@/lib/state";
import { ModalProvider } from "@/context/ModalContext";
import Link from "next/link";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "TaxFiler Pro | HMRC MTD ITSA Solution",
  description: "Streamline your HMRC Making Tax Digital for Income Tax Self Assessment (MTD ITSA) with our professional tax filing solution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <StateProvider>
          <ModalProvider>
            <div className="min-h-screen flex flex-col">
            {/* Navigation */}
            <nav className="bg-white shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center">
                    <Link href="/" className="flex-shrink-0 flex items-center">
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                        Tax Ready
                      </span>
                    </Link>
                    <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                      <Link href="/" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Dashboard
                      </Link>
                      <Link href="/access-detail" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        File Return
                      </Link>
                      <Link href="/digital-record" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Digital Record
                      </Link>
                      <Link href="/losses" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Losses
                      </Link>
                    </div>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:items-center">
                    <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none">
                      <span className="sr-only">View notifications</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </button>
                    <div className="ml-3 relative">
                      <div>
                        <button type="button" className="bg-white rounded-full flex text-sm focus:outline-none" id="user-menu" aria-expanded="false" aria-haspopup="true">
                          <span className="sr-only">Open user menu</span>
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-white font-medium">
                            U
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-12">
              <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
                <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
                  <div className="px-5 py-2">
                    <Link href="#" className="text-base text-gray-500 hover:text-gray-900">About</Link>
                  </div>
                  <div className="px-5 py-2">
                    <Link href="#" className="text-base text-gray-500 hover:text-gray-900">Pricing</Link>
                  </div>
                  <div className="px-5 py-2">
                    <Link href="#" className="text-base text-gray-500 hover:text-gray-900">Documentation</Link>
                  </div>
                  <div className="px-5 py-2">
                    <Link href="#" className="text-base text-gray-500 hover:text-gray-900">Privacy</Link>
                  </div>
                  <div className="px-5 py-2">
                    <Link href="#" className="text-base text-gray-500 hover:text-gray-900">Terms</Link>
                  </div>
                </nav>
                <p className="mt-8 text-center text-base text-gray-400">
                  &copy; {new Date().getFullYear()} TaxFiler Pro. All rights reserved.
                </p>
                <p className="mt-8 text-center text-base text-gray-400"> Our software implements HMRC Fraud Prevention Headers (Gov-Client headers) in all MTD ITSA API calls.
                </p>
              </div>
            </footer>
            </div>
          </ModalProvider>
        </StateProvider>
      </body>
    </html>
  );
}
