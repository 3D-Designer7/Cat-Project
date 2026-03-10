export const countries = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
];

export const getCountryByCode = (code: string) => countries.find(c => c.code === code);

export function getFlagEmoji(countryCode: string) {
  if (!countryCode) return '';
  return countryCode
    .toUpperCase()
    .replace(/./g, char =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

export async function detectUserCountry(): Promise<{ country_name: string; country_code: string } | null> {
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem('user_country');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }

  // 1. Try Geolocation API + Reverse Geocoding
  const getGeoLocation = (): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        (error) => {
          reject(error);
        },
        { timeout: 5000 }
      );
    });
  };

  try {
    const coords = await getGeoLocation();
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`);
    if (response.ok) {
      const data = await response.json();
      if (data.countryName && data.countryCode) {
        const result = {
          country_name: data.countryName,
          country_code: data.countryCode
        };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user_country', JSON.stringify(result));
        }
        return result;
      }
    }
  } catch (error) {
    console.warn('Geolocation or reverse geocoding failed, falling back to IP detection', error);
  }

  // 2. Fallback to IP detection
  try {
    // Try ipapi.co first
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      if (data.country_name && data.country_code) {
        const result = {
          country_name: data.country_name,
          country_code: data.country_code
        };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user_country', JSON.stringify(result));
        }
        return result;
      }
    }
  } catch (error) {
    console.warn('IP detection failed via ipapi.co', error);
  }

  try {
    // Fallback to ip-api.com
    const response = await fetch('http://ip-api.com/json');
    if (response.ok) {
      const data = await response.json();
      if (data.country && data.countryCode) {
        const result = {
          country_name: data.country,
          country_code: data.countryCode
        };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user_country', JSON.stringify(result));
        }
        return result;
      }
    }
  } catch (error) {
    console.warn('IP detection failed via ip-api.com', error);
  }

  return null;
}
