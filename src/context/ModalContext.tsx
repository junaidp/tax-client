"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface ModalContextType {
    message: string | null;
    showModal: (msg: string) => void;
    hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    const [message, setMessage] = useState<string | null>(null);

    const showModal = (msg: string) => setMessage(msg);
    const hideModal = () => setMessage(null);

    return (
        <ModalContext.Provider value={{ message, showModal, hideModal }}>
            {children}

            {message && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
                    onClick={hideModal}
                >
                    <div
                        className="bg-red-50 rounded-xl shadow-2xl w-80 overflow-hidden border-2 border-red-200"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            animation: 'modalShake 0.5s ease-out'
                        }}
                    >


                        {/* Title */}
                        <div className="text-center px-6">
                            <h3 className="text-red-800 font-bold text-xl mb-2">Error!</h3>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-6">
                            <p className="text-red-700 text-center text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 flex justify-center">
                            <button
                                onClick={hideModal}
                                className="px-8 py-2.5 bg-red-600 text-red font-semibold rounded-lg hover:bg-red-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes modalShake {
                    0%, 100% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    10%, 30%, 50%, 70%, 90% {
                        transform: translateX(-5px) scale(1.02);
                    }
                    20%, 40%, 60%, 80% {
                        transform: translateX(5px) scale(1.02);
                    }
                    0% {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                }
            `}</style>
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error("useModal must be used inside ModalProvider");
    return ctx;
};