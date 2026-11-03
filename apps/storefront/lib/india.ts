// Indian address/locale helpers - shared shape used across checkout and account pages.

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export function isValidIndianPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

export function isValidIndianMobile(mobile: string): boolean {
  let digitsOnly = mobile.replace(/[\s-]/g, '');
  // Only strip a "91" country-code prefix when it's unambiguous: an explicit "+91",
  // or a 12-digit string (91 + 10-digit number). A bare 10-digit number that happens
  // to start with 91 (e.g. 9123456780) is a valid number on its own and must be left intact.
  if (digitsOnly.startsWith('+91')) {
    digitsOnly = digitsOnly.slice(3);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.slice(2);
  }
  return /^[6-9][0-9]{9}$/.test(digitsOnly);
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
