// Live game-day weather from Open-Meteo (free, no API key, CORS-enabled).
// Forecasts reach ~16 days out; beyond that we report when the forecast opens.

const WMO = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'], 45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '❄️'], 80: ['Light showers', '🌦️'], 81: ['Showers', '🌧️'],
  82: ['Violent showers', '⛈️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Thunderstorm + hail', '⛈️'],
};

const HORIZON_DAYS = 15;
const CACHE_TTL = 10 * 60 * 1000; // refetch after 10 min so forecasts stay live
const cache = new Map();

// Local calendar date (YYYY-MM-DD) and hour of `date` in the venue's timezone.
function localParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: get('hour') };
}

export async function getMatchWeather(venue, kickoffUtc) {
  const kickoff = new Date(kickoffUtc);
  const daysOut = (kickoff - Date.now()) / 86400000;
  if (daysOut > HORIZON_DAYS) {
    return {
      status: 'too_far',
      opensInDays: Math.ceil(daysOut - HORIZON_DAYS),
    };
  }

  const { date, hour } = localParts(kickoff, venue.tz);
  const key = `${venue.stadium}|${date}|${hour}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result;

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${venue.lat}&longitude=${venue.lon}`
    + '&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code'
    + `&timezone=${encodeURIComponent(venue.tz)}`
    + `&start_date=${date}&end_date=${date}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.reason || res.statusText);

    const want = `${date}T${hour}:00`;
    let i = data.hourly.time.indexOf(want);
    if (i === -1) i = Math.min(Number(hour), data.hourly.time.length - 1);

    const code = data.hourly.weather_code[i];
    const [label, icon] = WMO[code] || ['—', '🌡️'];
    const result = {
      status: 'ok',
      code,
      tempC: data.hourly.temperature_2m[i],
      feelsC: data.hourly.apparent_temperature[i],
      precipProb: data.hourly.precipitation_probability[i],
      windKmh: data.hourly.wind_speed_10m[i],
      label, icon,
      isPast: kickoff < Date.now(),
    };
    cache.set(key, { result, at: Date.now() });
    return result;
  } catch (err) {
    return { status: 'error', message: String(err.message || err) };
  }
}

export const cToF = (c) => Math.round(c * 9 / 5 + 32);
export const kmhToMph = (k) => Math.round(k / 1.609344);
