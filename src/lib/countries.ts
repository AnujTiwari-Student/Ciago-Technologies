export type Country = {
  name: string;
  code: string;
  dialCode: string;
};

export const COUNTRIES: Country[] = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "Australia", code: "AU", dialCode: "+61" },
  { name: "Germany", code: "DE", dialCode: "+49" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Spain", code: "ES", dialCode: "+34" },
  { name: "Italy", code: "IT", dialCode: "+39" },
  { name: "Netherlands", code: "NL", dialCode: "+31" },
  { name: "Belgium", code: "BE", dialCode: "+32" },
  { name: "Switzerland", code: "CH", dialCode: "+41" },
  { name: "Austria", code: "AT", dialCode: "+43" },
  { name: "Sweden", code: "SE", dialCode: "+46" },
  { name: "Norway", code: "NO", dialCode: "+47" },
  { name: "Denmark", code: "DK", dialCode: "+45" },
  { name: "Finland", code: "FI", dialCode: "+358" },
  { name: "Ireland", code: "IE", dialCode: "+353" },
  { name: "Portugal", code: "PT", dialCode: "+351" },
  { name: "Poland", code: "PL", dialCode: "+48" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420" },
  { name: "Hungary", code: "HU", dialCode: "+36" },
  { name: "Romania", code: "RO", dialCode: "+40" },
  { name: "Greece", code: "GR", dialCode: "+30" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
  { name: "Japan", code: "JP", dialCode: "+81" },
  { name: "South Korea", code: "KR", dialCode: "+82" },
  { name: "China", code: "CN", dialCode: "+86" },
  { name: "Hong Kong", code: "HK", dialCode: "+852" },
  { name: "Taiwan", code: "TW", dialCode: "+886" },
  { name: "Malaysia", code: "MY", dialCode: "+60" },
  { name: "Thailand", code: "TH", dialCode: "+66" },
  { name: "Indonesia", code: "ID", dialCode: "+62" },
  { name: "Philippines", code: "PH", dialCode: "+63" },
  { name: "Vietnam", code: "VN", dialCode: "+84" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966" },
  { name: "Israel", code: "IL", dialCode: "+972" },
  { name: "Turkey", code: "TR", dialCode: "+90" },
  { name: "South Africa", code: "ZA", dialCode: "+27" },
  { name: "Brazil", code: "BR", dialCode: "+55" },
  { name: "Mexico", code: "MX", dialCode: "+52" },
  { name: "Argentina", code: "AR", dialCode: "+54" },
  { name: "Chile", code: "CL", dialCode: "+56" },
  { name: "Colombia", code: "CO", dialCode: "+57" },
  { name: "New Zealand", code: "NZ", dialCode: "+64" },
  { name: "Russia", code: "RU", dialCode: "+7" },
  { name: "Ukraine", code: "UA", dialCode: "+380" },
  { name: "Egypt", code: "EG", dialCode: "+20" },
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "Kenya", code: "KE", dialCode: "+254" },
  { name: "Bangladesh", code: "BD", dialCode: "+880" },
  { name: "Pakistan", code: "PK", dialCode: "+92" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94" },
  { name: "Nepal", code: "NP", dialCode: "+977" },
];

export function getCountryByName(name: string): Country | undefined {
  return COUNTRIES.find((c) => c.name === name);
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function getDialCodeForCountry(countryName: string): string {
  const country = getCountryByName(countryName);
  return country?.dialCode || "";
}
