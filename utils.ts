/**
 * Normalizes a URL to ensure it has a protocol.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Replaces variables in a URL string with values from localStorage.
 */
export function replaceVariables(url: string): string {
  return url.replace(/\{([^{}:]+)\}/g, (_, key) => {
    return localStorage.getItem(key.trim()) || `{${key}}`;
  });
}

/**
 * Extracts and saves variables from a URL pattern like {repo:nishant/project}.
 * Returns the URL with simple placeholders like {repo}.
 */
export function extractAndSaveVariables(url: string): string {
  return url.replace(/\{([^:{}]+):([^{}]+)\}/g, (_, key, value) => {
    const cleanKey = key.trim();
    const cleanValue = value.trim();
    if (cleanKey && cleanValue) {
      localStorage.setItem(cleanKey, cleanValue);
    }
    return `{${cleanKey}}`;
  });
}

/**
 * Gets a clean, readable display URL.
 */
export function getReadableUrl(url: string): string {
  const substituted = replaceVariables(url);
  try {
    const parsed = new URL(substituted);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/^www\./, "");
  } catch {
    return substituted || "Untitled link";
  }
}

/**
 * Formats a timestamp to DD/MM/YY.
 */
export function formatTimestamp(millis?: number): string {
  if (!millis) return "";
  const date = new Date(millis);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
}
