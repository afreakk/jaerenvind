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
    { name: 'syltertangen', coordinates: [58.69763, 5.540570000000002] },
    { name: 'nærlandssanden', coordinates: [58.68483, 5.549070000000029] },
];

export const getTimeSerie = async (location) => ({
    timeseries: (
        await (
            await fetch(
                `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${location.coordinates[0]}&lon=${location.coordinates[1]}`
            )
        ).json()
    ).properties.timeseries,
    name: location.name,
});

export const getCachedTimeSerie = async () => {
    let yup = JSON.parse(localStorage.getItem('cachedLocationData'));
    if (!yup || yup.date < new Date() - 300000) {
        yup = await Promise.all(
            locations.map(async (l) => {
                return await getTimeSerie(l);
            })
        );
        localStorage.setItem(
            'cachedLocationData',
            JSON.stringify({ date: +new Date(), yup })
        );
    } else {
        yup = yup.yup;
    }
    return yup;
};

export const degToCompass = (num) =>
    [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
    ][parseInt(num / 22.5 + 0.5) % 16];
