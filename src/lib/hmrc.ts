export type HeaderDTO = {
  govClientBrowserJSUserAgent: string;
  govClientDeviceID: string;
  govClientMultiFactor: string;
  govClientPublicIP: string;
  govClientPublicIPTimestamp: string;
  govClientPublicPort: string;
  govClientScreens: string;
  govClientTimezone: string;
  govClientUserIDs: string;
  govClientWindowSize: string;
  govClientConnectionMethod: string;
};

export function buildHeaderDTO(): HeaderDTO {
  if (typeof window === "undefined") {
    return {
      govClientBrowserJSUserAgent: "",
      govClientDeviceID: "",
      govClientMultiFactor: "",
      govClientPublicIP: "",
      govClientPublicIPTimestamp: "",
      govClientPublicPort: "",
      govClientScreens: "",
      govClientTimezone: "",
      govClientUserIDs: "",
      govClientWindowSize: "",
      govClientConnectionMethod: "",
    };
  }
  const ua = navigator.userAgent;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const screens = `${window.screen.width}x${window.screen.height}`;
  const win = `${window.innerWidth}x${window.innerHeight}`;
  return {
    govClientBrowserJSUserAgent: ua,
    govClientDeviceID: "",
    govClientMultiFactor: "",
    govClientPublicIP: "",
    govClientPublicIPTimestamp: "",
    govClientPublicPort: "",
    govClientScreens: screens,
    govClientTimezone: tz,
    govClientUserIDs: "",
    govClientWindowSize: win,
    govClientConnectionMethod: "",
  };
}

// Some Spring configurations expect a single request param named `headerDTO` that contains
// a JSON-encoded HeaderDTO string. This helper returns the properly URL-encoded string value
// suitable for appending as `headerDTO=<encoded JSON>` in the query string.
export function buildHeaderDTOParam(): string {
  const dto = buildHeaderDTO();
  // URL-encode the JSON string for safe inclusion as a query param
  return encodeURIComponent(JSON.stringify(dto));
}
