// lib/fraudHeadersFrontend.ts
export type FraudHeaders = {
    "Gov-Client-Screens"?: string;
    "Gov-Client-User-Agent"?: string;
    "Gov-Client-Device-ID"?: string;
    "Gov-Client-Timezone"?: string;
    "Gov-Client-Window-Size"?: string;
    "Gov-Client-Color-Depth"?: string;
    "Gov-Client-User-Language"?: string;
    "Gov-Client-Device-OS"?: string;
    "Gov-Vendor-Version"?: string;

    // Browser cannot reliably provide these — leave blank and let backend add/enrich:
    "Gov-Client-Local-IP"?: string;
    "Gov-Client-Local-Ports"?: string;
    "Gov-Client-MAC-Addresses"?: string;
};

const SESSION_KEY = "fraudHeaders";
const DEVICE_ID_KEY = "gov-client-device-id";

/**
 * Create or return a persistent device id stored in localStorage.
 * localStorage so device id is stable across sessions (useful for fraud headers).
 */
function getOrCreateDeviceId(): string {
    if (typeof window === "undefined") return "";
    try {
        let id: string | null = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            // prefer crypto.randomUUID if available
            // fallback to timestamp + random string
            id =
                typeof (crypto as any)?.randomUUID === "function"
                    ? (crypto as any).randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch (err) {
        // In very locked-down browsers localStorage may throw — fallback
        return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}

/**
 * Generate fraud headers from browser data.
 * Note: some fields required by HMRC (public IP, ports, MACs) must be enriched on the backend.
 */
export function generateFraudHeaders(): FraudHeaders {
    if (typeof window === "undefined") return {};

    const deviceId = getOrCreateDeviceId();
    const ua = navigator.userAgent || "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const windowSize = `${window.innerWidth}x${window.innerHeight}`;
    const screens = `${window.screen.width}x${window.screen.height}`;
    const colorDepth = String(window.screen.colorDepth || "");
    const language =
        (navigator.languages && navigator.languages[0]) ||
        navigator.language ||
        (navigator as any).userLanguage ||
        "";
    const deviceOS = navigator.platform || "";

    const vendorVersion =
        typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION
            ? `taxClient=${process.env.NEXT_PUBLIC_APP_VERSION}`
            : "taxClient=1.0.0";

    const headers: FraudHeaders = {
        "Gov-Client-Screens": `${screens}x${colorDepth}`, // e.g. "1366x768x24"
        "Gov-Client-User-Agent": ua,
        "Gov-Client-Device-ID": deviceId,
        "Gov-Client-Timezone": timezone,
        "Gov-Client-Window-Size": windowSize,
        "Gov-Client-Color-Depth": colorDepth,
        "Gov-Client-User-Language": language,
        "Gov-Client-Device-OS": deviceOS,
        "Gov-Vendor-Version": vendorVersion,

        // backend should fill these:
        "Gov-Client-Local-IP": "",
        "Gov-Client-Local-Ports": "",
        "Gov-Client-MAC-Addresses": "",
    };

    return headers;
}

/** Save fraud headers to sessionStorage (so they are available for subsequent requests). */
export function saveFraudHeadersToSession(headers: FraudHeaders): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(headers));
    } catch (err) {
        // ignore/storage errors
        console.warn("Failed to save fraud headers to sessionStorage", err);
    }
}

/** Load fraud headers from sessionStorage (if previously stored). */
export function loadFraudHeadersFromSession(): FraudHeaders | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as FraudHeaders;
    } catch (err) {
        return null;
    }
}

/**
 * Get existing fraud headers from sessionStorage, or generate + persist them.
 * Use this in your frontend before calling your backend to ensure fraud headers are always sent.
 */
export function getOrGenerateAndPersistFraudHeaders(): FraudHeaders {
    let headers = loadFraudHeadersFromSession();
    if (!headers) {
        headers = generateFraudHeaders();
        saveFraudHeadersToSession(headers);
    }
    return headers;
}
