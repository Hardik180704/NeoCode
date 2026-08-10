export const DEFAULT_API_URL = "https://neocodeserver-production.up.railway.app";

export function getApiUrl() {
  return (process.env.API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
}
