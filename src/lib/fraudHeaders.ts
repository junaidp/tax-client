import { NextApiRequest } from "next";

export function buildFraudHeaders(req: NextApiRequest) {
    // Pull from frontend if provided (e.g. sessionStorage sent via axios headers)
    const clientHeaders = req.headers || {};

    // Get server-side IP (fallback if frontend cannot supply)
    const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "";

    return {
        // From frontend (browser-sourced values)
        "Gov-Client-Screens": clientHeaders["gov-client-screens"] || "",
        "Gov-Client-User-Agent":
            clientHeaders["gov-client-user-agent"] || req.headers["user-agent"] || "",
        "Gov-Client-Device-ID": clientHeaders["gov-client-device-id"] || "",

        // Server enrichments
        "Gov-Client-Public-IP": ip,
        "Gov-Client-Public-Port": req.socket.remotePort?.toString() || "",
        "Gov-Client-Timezone":
            clientHeaders["gov-client-timezone"] ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,

        // Vendor info
        "Gov-Vendor-Version": "taxClient=1.0.0",
    };
}
