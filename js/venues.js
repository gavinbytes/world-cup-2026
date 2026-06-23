// World Cup 2026 venues, keyed by the Location names used in the fixture feed.
// Each `style` drives the procedural stadium model: real seat colours and the
// venue's signature architecture (roof type, berm, masts, arches…).
export const VENUES = {
  'Mexico City Stadium': {
    stadium: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico',
    lat: 19.3029, lon: -99.1505, tz: 'America/Mexico_City',
    capacity: 87523, roof: 'open',
    style: {
      seats: [0xd9a13b, 0x9e2b25, 0x3b4668], facade: 0x4f4a45,
      roofType: 'ring', roofColor: 0x8f969f, lights: false,
    },
  },
  'Guadalajara Stadium': {
    stadium: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico',
    lat: 20.6817, lon: -103.4626, tz: 'America/Mexico_City',
    capacity: 48071, roof: 'open',
    style: {
      seats: [0xc8102e, 0xc8102e, 0xe8e8e8], noFacade: true,
      roofType: 'ring', roofColor: 0xf4f6f8, lights: false,
      extras: ['berm'],
    },
  },
  'Monterrey Stadium': {
    stadium: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico',
    lat: 25.6693, lon: -100.2442, tz: 'America/Monterrey',
    capacity: 53500, roof: 'open',
    style: {
      seats: [0x1c2a4a, 0x2a3c66, 0x1c2a4a], facade: 0x9aa2ad,
      roofType: 'asym', roofColor: 0xb9c0c9, lights: false,
    },
  },
  'BC Place Vancouver': {
    stadium: 'BC Place', city: 'Vancouver', country: 'Canada',
    lat: 49.2767, lon: -123.1119, tz: 'America/Vancouver',
    capacity: 54500, roof: 'retractable',
    style: {
      seats: [0x2a5caa, 0x88a9d6, 0x2a5caa], facade: 0xc9ced6,
      roofType: 'ring', roofColor: 0xeef1f5, lights: false,
      extras: ['masts'],
    },
  },
  'Toronto Stadium': {
    stadium: 'BMO Field', city: 'Toronto', country: 'Canada',
    lat: 43.6332, lon: -79.4186, tz: 'America/Toronto',
    capacity: 45736, roof: 'open',
    style: {
      seats: [0xb81f2d, 0xb81f2d, 0x494f57], facade: 0x3c424a,
      roofType: 'canopies', roofColor: 0x70777f, canopySpan: [45, 135],
      canopyInner: [1.05, 0.80], lights: true,
    },
  },
  'Seattle Stadium': {
    stadium: 'Lumen Field', city: 'Seattle', country: 'USA',
    lat: 47.5952, lon: -122.3316, tz: 'America/Los_Angeles',
    capacity: 69000, roof: 'open',
    style: {
      seats: [0x0c2340, 0x2f5d50, 0x0c2340], facade: 0x6f767f,
      roofType: 'canopies', roofColor: 0xdfe3e8, canopySpan: [32, 148],
      canopyInner: [0.90, 0.66], lights: false,
    },
  },
  'San Francisco Bay Area Stadium': {
    stadium: "Levi's Stadium", city: 'Santa Clara', country: 'USA',
    lat: 37.4030, lon: -121.9696, tz: 'America/Los_Angeles',
    capacity: 70909, roof: 'open',
    style: {
      seats: [0xaa1e22, 0xaa1e22, 0xc7a558], facade: 0xd8dadc,
      roofType: 'none', lights: true,
      extras: ['tower'],
    },
  },
  'Los Angeles Stadium': {
    stadium: 'SoFi Stadium', city: 'Inglewood', country: 'USA',
    lat: 33.9535, lon: -118.3392, tz: 'America/Los_Angeles',
    capacity: 70240, roof: 'fixed',
    style: {
      seats: [0x23304a, 0x2c3c5c, 0x23304a], facade: 0xdfe4ea,
      roofType: 'dome', roofColor: 0xf2f5f9, lights: false,
    },
  },
  'Dallas Stadium': {
    stadium: 'AT&T Stadium', city: 'Arlington', country: 'USA',
    lat: 32.7473, lon: -97.0945, tz: 'America/Chicago',
    capacity: 80000, roof: 'retractable',
    style: {
      seats: [0x37414f, 0x4d5a6b, 0x37414f], facade: 0xc7ccd2,
      roofType: 'retractable', roofColor: 0xaab1b9, lights: false,
      extras: ['arches'],
    },
  },
  'Houston Stadium': {
    stadium: 'NRG Stadium', city: 'Houston', country: 'USA',
    lat: 29.6847, lon: -95.4107, tz: 'America/Chicago',
    capacity: 72220, roof: 'retractable',
    style: {
      seats: [0x03202f, 0x0d3a52, 0x03202f], facade: 0x8f99a3,
      roofType: 'retractable', roofColor: 0xc3c9cf, lights: false,
    },
  },
  'Kansas City Stadium': {
    stadium: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA',
    lat: 39.0489, lon: -94.4839, tz: 'America/Chicago',
    capacity: 76416, roof: 'open',
    style: {
      seats: [0xc8102e, 0xc8102e, 0xc8102e], facade: 0x8a8f96,
      roofType: 'canopies', roofColor: 0xd6d9de, canopySpan: [40, 140],
      canopyInner: [1.02, 0.76], lights: true,
    },
  },
  'Atlanta Stadium': {
    stadium: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA',
    lat: 33.7554, lon: -84.4010, tz: 'America/New_York',
    capacity: 71000, roof: 'retractable',
    style: {
      seats: [0x2b2b30, 0xa6192e, 0x2b2b30], facade: 0x39424e,
      roofType: 'pinwheel', roofColor: 0xb7bdc6, lights: false,
    },
  },
  'Miami Stadium': {
    stadium: 'Hard Rock Stadium', city: 'Miami Gardens', country: 'USA',
    lat: 25.9580, lon: -80.2389, tz: 'America/New_York',
    capacity: 64767, roof: 'open',
    style: {
      seats: [0x008e97, 0x35b0b8, 0x008e97], facade: 0xe9ecef,
      roofType: 'ring', roofColor: 0xe8ebee, ringInner: [1.00, 0.75],
      lights: false, extras: ['pylons'],
    },
  },
  'Boston Stadium': {
    stadium: 'Gillette Stadium', city: 'Foxborough', country: 'USA',
    lat: 42.0909, lon: -71.2643, tz: 'America/New_York',
    capacity: 65878, roof: 'open',
    style: {
      seats: [0x002244, 0x8a8d8f, 0x002244], facade: 0x7d838a,
      roofType: 'canopies', roofColor: 0xbfc5cc, canopySpan: [55, 125],
      canopyInner: [1.1, 0.85], lights: true,
      extras: ['lighthouse'],
    },
  },
  'Philadelphia Stadium': {
    stadium: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA',
    lat: 39.9008, lon: -75.1675, tz: 'America/New_York',
    capacity: 69796, roof: 'open',
    style: {
      seats: [0x004c54, 0x004c54, 0x565a5c], facade: 0x5c6670,
      roofType: 'canopies', roofColor: 0xc6ccd2, canopySpan: [38, 142],
      canopyInner: [1.00, 0.74], lights: true,
    },
  },
  'New York/New Jersey Stadium': {
    stadium: 'MetLife Stadium', city: 'East Rutherford', country: 'USA',
    lat: 40.8135, lon: -74.0745, tz: 'America/New_York',
    capacity: 82500, roof: 'open',
    style: {
      seats: [0x6e7681, 0x8b939e, 0x6e7681], facade: 0xc2c7cd,
      roofType: 'ring', roofColor: 0xd9dde2, ringInner: [1.35, 1.05],
      lights: true,
    },
  },
};

export const COUNTRY_COLORS = {
  Mexico: 0x21c462,
  Canada: 0xff5252,
  USA: 0x4f8cff,
};

export const ROOF_LABELS = {
  open: 'Open-air stadium',
  fixed: 'Covered (fixed roof)',
  retractable: 'Retractable roof',
};

export const TEAM_FLAGS = {
  'Algeria': '🇩🇿', 'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹',
  'Belgium': '🇧🇪', 'Bosnia and Herzegovina': '🇧🇦', 'Brazil': '🇧🇷',
  'Cabo Verde': '🇨🇻', 'Canada': '🇨🇦', 'Colombia': '🇨🇴', 'Congo DR': '🇨🇩',
  'Croatia': '🇭🇷', 'Curaçao': '🇨🇼', 'Czechia': '🇨🇿', "Côte d'Ivoire": '🇨🇮',
  'Ecuador': '🇪🇨', 'Egypt': '🇪🇬', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷',
  'Germany': '🇩🇪', 'Ghana': '🇬🇭', 'Haiti': '🇭🇹', 'IR Iran': '🇮🇷',
  'Iraq': '🇮🇶', 'Japan': '🇯🇵', 'Jordan': '🇯🇴', 'Korea Republic': '🇰🇷',
  'Mexico': '🇲🇽', 'Morocco': '🇲🇦', 'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿',
  'Norway': '🇳🇴', 'Panama': '🇵🇦', 'Paraguay': '🇵🇾', 'Portugal': '🇵🇹',
  'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Senegal': '🇸🇳',
  'South Africa': '🇿🇦', 'Spain': '🇪🇸', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳', 'Türkiye': '🇹🇷', 'USA': '🇺🇸', 'Uruguay': '🇺🇾',
  'Uzbekistan': '🇺🇿',
};

// Primary home-kit colour per team, for the little players on the pitch.
export const TEAM_COLORS = {
  'Algeria': 0xffffff, 'Argentina': 0x75aadb, 'Australia': 0xffcd00,
  'Austria': 0xed2939, 'Belgium': 0xed2939, 'Bosnia and Herzegovina': 0x002395,
  'Brazil': 0xffdc00, 'Cabo Verde': 0x003893, 'Canada': 0xe03131,
  'Colombia': 0xffcd00, 'Congo DR': 0x007fff, 'Croatia': 0xffffff,
  'Curaçao': 0x002b7f, 'Czechia': 0xd7141a, "Côte d'Ivoire": 0xf77f00,
  'Ecuador': 0xffdd00, 'Egypt': 0xce1126, 'England': 0xffffff,
  'France': 0x21304d, 'Germany': 0xffffff, 'Ghana': 0xffffff,
  'Haiti': 0x00209f, 'IR Iran': 0xffffff, 'Iraq': 0x007a3d,
  'Japan': 0x1d2088, 'Jordan': 0xffffff, 'Korea Republic': 0xcd2e3a,
  'Mexico': 0x006847, 'Morocco': 0xc1272d, 'Netherlands': 0xff7f00,
  'New Zealand': 0xffffff, 'Norway': 0xef2b2d, 'Panama': 0xda121a,
  'Paraguay': 0xd52b1e, 'Portugal': 0xa50021, 'Qatar': 0x8a1538,
  'Saudi Arabia': 0x006c35, 'Scotland': 0x0c2340, 'Senegal': 0xffffff,
  'South Africa': 0xffb612, 'Spain': 0xc60b1e, 'Sweden': 0xfecc00,
  'Switzerland': 0xd52b1e, 'Tunisia': 0xffffff, 'Türkiye': 0xe30a17,
  'USA': 0xffffff, 'Uruguay': 0x7bc4ef,
  'Uzbekistan': 0xffffff,
};

function colorDist(a, b) {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Kit colours for a fixture; falls back for placeholders and resolves clashes.
export function kitColors(home, away) {
  let a = TEAM_COLORS[home] ?? 0xd83a3a;
  let b = TEAM_COLORS[away] ?? 0x3a62d8;
  if (colorDist(a, b) < 110) {
    b = colorDist(a, 0x2a62d6) > 110 ? 0x2a62d6 : 0xd83a3a;
  }
  return [a, b];
}

// Knockout-stage placeholders like "1A" / "2B" / "3ABCDF" → readable label.
export function teamLabel(name) {
  if (!name || name === 'To be announced') return 'TBD';
  let m = name.match(/^1([A-L])$/);
  if (m) return `Winner Group ${m[1]}`;
  m = name.match(/^2([A-L])$/);
  if (m) return `Runner-up Group ${m[1]}`;
  m = name.match(/^3([A-L]+)$/);
  if (m) return `3rd place (${m[1].split('').join('/')})`;
  if (/^[WL]\d+$/.test(name)) return (name[0] === 'W' ? 'Winner Match ' : 'Loser Match ') + name.slice(1);
  return name;
}

export function teamFlag(name) {
  return TEAM_FLAGS[name] || '⚽';
}

export function roundLabel(match) {
  if (match.Group) return match.Group;
  const n = match.MatchNumber;
  if (n <= 88) return 'Round of 32';
  if (n <= 96) return 'Round of 16';
  if (n <= 100) return 'Quarter-final';
  if (n <= 102) return 'Semi-final';
  if (n === 103) return 'Third place';
  return 'Final';
}
