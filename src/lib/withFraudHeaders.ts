import type { NextApiRequest, NextApiResponse } from "next";
import { buildFraudHeaders } from "./fraudHeaders";
import axios from "axios";

export type Handler = (
    req: NextApiRequest,
    res: NextApiResponse,
    fraudHeaders: Record<string, string>
) => Promise<void>;

export function withFraudHeaders(handler: Handler) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        const fraudHeadersRaw = buildFraudHeaders(req);

        // Convert any string[] → comma-separated string
        const fraudHeaders: Record<string, string> = Object.fromEntries(
            Object.entries(fraudHeadersRaw).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(",") : value,
            ])
        );

        return handler(req, res, fraudHeaders);
    };
}


// Helper for calling HMRC with fraud headers
export async function hmrcGet(
    url: string,
    token: string,
    fraudHeaders: Record<string, string>
) {
    return axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...fraudHeaders,
        },
    });
}
