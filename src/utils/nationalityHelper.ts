// Utility for nationalities, country lists, and national flags

export interface CountryInfo {
  name: string;
  code: string;
  flag: string; // Emoji flag
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'USA', code: 'US', flag: '🇺🇸' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
  { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
];

export const DEFAULT_COUNTRY_NAMES = SUPPORTED_COUNTRIES.map((c) => c.name);

const FLAG_MAP: Record<string, string> = {
  'South Korea': '🇰🇷',
  'Korea': '🇰🇷',
  'South korea': '🇰🇷',
  'south korea': '🇰🇷',
  'Japan': '🇯🇵',
  'japan': '🇯🇵',
  'China': '🇨🇳',
  'china': '🇨🇳',
  'USA': '🇺🇸',
  'United States': '🇺🇸',
  'usa': '🇺🇸',
  'Australia': '🇦🇺',
  'australia': '🇦🇺',
  'Thailand': '🇹🇭',
  'thailand': '🇹🇭',
  'Taiwan': '🇹🇼',
  'taiwan': '🇹🇼',
  'New Zealand': '🇳🇿',
  'new zealand': '🇳🇿',
  'Vietnam': '🇻🇳',
  'vietnam': '🇻🇳',
  'Indonesia': '🇮🇩',
  'indonesia': '🇮🇩',
  'Canada': '🇨🇦',
  'canada': '🇨🇦',
  'Philippines': '🇵🇭',
  'Malaysia': '🇲🇾',
  'Singapore': '🇸🇬',
  'United Kingdom': '🇬🇧',
  'UK': '🇬🇧',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Brazil': '🇧🇷',
  'Mexico': '🇲🇽',
};

export function getCountryFlag(countryName?: string | null): string {
  if (!countryName) return '🌐';
  const trimmed = countryName.trim();
  if (FLAG_MAP[trimmed]) return FLAG_MAP[trimmed];
  const found = SUPPORTED_COUNTRIES.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.flag : '🌐';
}
