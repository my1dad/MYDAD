export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** Formats US phone numbers as (555) 555-0100 while typing. */
export function formatPhoneInput(value: string): string {
  const digits = stripPhoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
