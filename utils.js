import SunCalc from 'suncalc';

// Center of Jæren area — all spots are close enough for shared sunrise/sunset
export const JAEREN_CENTER = { lat: 58.9, lon: 5.6 };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEGREES_PER_COMPASS_SECTOR = 22.5;

export const MS_TO_KNOTS = 1.9438452;

export const locations = [
    { name: 'sokn', coordinates: [59.05457902524904, 5.678849408617339] },
    {
        name: 'sandestranden',
        coordinates: [59.01795083498445, 5.588636433752413],
    },
    {
        name: 'harestadvika',
        coordinates: [59.01501042866349, 5.6390239691650095],
    },
    {
        name: 'malthaugbrautene',
        coordinates: [58.955234975464634, 5.621060412724773],
    },
    {
        name: 'håhammarbrautene',
        coordinates: [58.93124735525694, 5.642344124456258],
    },
    { name: 'liapynten', coordinates: [58.93375, 5.682029999999941] },
    { name: 'sømmevågen', coordinates: [58.90017, 5.636110000000031] },
    { name: 'sirigrunnen', coordinates: [58.96802, 5.765909999999963] },
    { name: 'vaulen', coordinates: [58.92472, 5.7487599999999475] },
    { name: 'solasanden', coordinates: [58.88217149891776, 5.597322917566316] },
    { name: 'rege', coordinates: [58.876984214472, 5.592756306798037] },
    { name: 'ølbørsanden', coordinates: [58.87012, 5.5693200000000616] },
    { name: 'hellestøstranden', coordinates: [58.83583, 5.551389999999969] },
    { name: 'selestranda', coordinates: [58.81598, 5.541879999999992] },
    { name: 'boresanden', coordinates: [58.79485, 5.54672000000005] },
    { name: 'revehamnen', coordinates: [58.77161, 5.514279999999985] },
    { name: 'søre revtangen', coordinates: [58.75211, 5.489759999999933] },
    { name: 'skeie', coordinates: [58.69763, 5.540570000000002] },
    { name: 'refsnes', coordinates: [58.68483, 5.549070000000029] },
    { name: 'brusand', coordinates: [58.53274309602588, 5.755182824765484] },
];

export const getTimeSerie = async (location) => {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${location.coordinates[0]}&lon=${location.coordinates[1]}`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'jaerenvind/1.0 github.com/jaerenvind' },
    });
    if (!response.ok) {
        throw new Error(`MET API error ${response.status} for ${location.name}`);
    }
    const json = await response.json();
    return {
        timeseries: json.properties.timeseries,
        name: location.name,
    };
};

// In-memory cache to avoid re-parsing localStorage on every state change
let memoryCache = null;

export const getCachedTimeSerie = async () => {
    // Return memory cache if still valid
    if (memoryCache && memoryCache.date > Date.now() - CACHE_TTL_MS) {
        return memoryCache.data;
    }

    // Try localStorage
    try {
        const stored = JSON.parse(localStorage.getItem('cachedLocationData'));
        if (stored && stored.date > Date.now() - CACHE_TTL_MS) {
            memoryCache = { date: stored.date, data: stored.data };
            return stored.data;
        }
    } catch {
        // Corrupt localStorage data — proceed to fetch
    }

    // Fetch fresh data, tolerating individual failures
    const results = await Promise.allSettled(
        locations.map((location) => getTimeSerie(location))
    );
    const fulfilled = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);

    if (fulfilled.length === 0) {
        throw new Error('Failed to fetch wind data from MET API');
    }

    // Cache in memory and localStorage
    memoryCache = { date: Date.now(), data: fulfilled };
    try {
        localStorage.setItem(
            'cachedLocationData',
            JSON.stringify({ date: Date.now(), data: fulfilled })
        );
    } catch {
        // localStorage full or unavailable — continue without caching
    }

    return fulfilled;
};

const compassDirections = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export const degToCompass = (num) =>
    compassDirections[Math.round(num / DEGREES_PER_COMPASS_SECTOR) % 16];

// Check if a given time is during daylight hours
export const isDaylight = (timeString) => {
    const date = new Date(timeString);
    const times = SunCalc.getTimes(date, JAEREN_CENTER.lat, JAEREN_CENTER.lon);
    return date >= times.sunrise && date <= times.sunset;
};

// Filter timeseries to only include daylight hours
export const filterDaylightHours = (timeseries) => {
    return timeseries.filter((entry) => isDaylight(entry.time));
};
