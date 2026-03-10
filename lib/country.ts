export const detectCountry = async (): Promise<{ country_name: string, country_code: string } | null> => {
  return new Promise((resolve) => {
    const fallbackToIP = async () => {
      try {
        // Try bigdatacloud IP-based reverse geocode first
        const ipRes = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
        if (ipRes.ok) {
          const data = await ipRes.json();
          if (data.countryName && data.countryCode) {
            resolve({ country_name: data.countryName, country_code: data.countryCode });
            return;
          }
        }
        
        // Another fallback
        const ipapiRes = await fetch('https://ipapi.co/json/');
        if (ipapiRes.ok) {
          const data = await ipapiRes.json();
          if (data.country_name && data.country_code) {
            resolve({ country_name: data.country_name, country_code: data.country_code });
            return;
          }
        }
        
        // Final fallback
        const ipinfoRes = await fetch('https://ipinfo.io/json');
        if (ipinfoRes.ok) {
          const data = await ipinfoRes.json();
          if (data.country) {
            // ipinfo only returns country code, we can just use it for both or try to map it
            resolve({ country_name: data.country, country_code: data.country });
            return;
          }
        }
        
        resolve(null);
      } catch (err) {
        console.error("IP fallback failed", err);
        resolve(null);
      }
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            if (res.ok) {
              const data = await res.json();
              if (data.countryName && data.countryCode) {
                resolve({ country_name: data.countryName, country_code: data.countryCode });
                return;
              }
            }
            fallbackToIP();
          } catch (err) {
            console.error("Reverse geocoding failed", err);
            fallbackToIP();
          }
        },
        (error) => {
          console.warn("Geolocation permission denied or failed", error);
          fallbackToIP();
        },
        { timeout: 5000 }
      );
    } else {
      fallbackToIP();
    }
  });
};
