/** Masks an email for logging: "jo***@example.com" instead of the full address. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}

/** Masks a phone number for logging: "+91XXXXXX6789" instead of the full number. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const prefix = phone.startsWith('+') ? phone.slice(0, phone.length - digits.length) : '';
  return `${prefix}${'X'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** Masks an OTP destination for logging, auto-detecting whether it's an email or a phone number. */
export function maskDestination(destination: string): string {
  return destination.includes('@') ? maskEmail(destination) : maskPhone(destination);
}
