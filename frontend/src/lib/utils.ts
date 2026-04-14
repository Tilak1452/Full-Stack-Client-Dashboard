/** Format a number as Indian Rupees with abbreviation */
export function formatINR(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1e12) return `₹${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `₹${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e7)  return `₹${(value / 1e7).toFixed(2)}Cr`;
  if (value >= 1e5)  return `₹${(value / 1e5).toFixed(2)}L`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Format percentage with sign and fixed decimals */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Format a date string to readable format */
export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

/** Format a date string to time only */
export function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/** Determine text color class from a boolean (up/down) */
export function changeColor(up: boolean | null): string {
  if (up === null) return 'text-muted';
  return up ? 'text-green' : 'text-red';
}
