import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { format } from 'date-fns';
import SunCalc from 'suncalc';
import * as utils from './utils';

Chart.register(zoomPlugin, annotationPlugin);

const isTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    matchMedia('(pointer: coarse)').matches;

// Wing size wind zones (knots) — based on wing foil sizing chart
const wingZones = [
    { size: '5.5m²', min: 12, max: 22, color: 'rgba(76, 175, 80, 0.08)' },
    { size: '5.0m²', min: 14, max: 25, color: 'rgba(139, 195, 74, 0.08)' },
    { size: '4.5m²', min: 18, max: 28, color: 'rgba(205, 220, 57, 0.08)' },
    { size: '4.0m²', min: 22, max: 32, color: 'rgba(255, 235, 59, 0.08)' },
    { size: '3.5m²', min: 25, max: 35, color: 'rgba(255, 193, 7, 0.08)' },
    { size: '3.0m²', min: 28, max: 38, color: 'rgba(255, 152, 0, 0.08)' },
    { size: '2.5m²', min: 30, max: 42, color: 'rgba(255, 87, 34, 0.08)' },
    { size: '2.0m²', min: 35, max: 45, color: 'rgba(244, 67, 54, 0.08)' },
];

// 20 maximally distinct colors for each spot
const spotColors = [
    '#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
    '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ffe119',
];

// --- Annotation builders ---

const generateWingZoneAnnotations = () => {
    const annotations = {};
    wingZones.forEach((zone, index) => {
        annotations[`wingZone${index}`] = {
            type: 'box',
            yMin: zone.min,
            yMax: zone.max,
            backgroundColor: zone.color,
            borderWidth: 0,
            label: {
                display: true,
                content: zone.size,
                position: { x: 'end', y: 'center' },
                font: { size: 10, weight: 'bold' },
                color: '#aaa',
            },
        };
    });
    return annotations;
};

const generateDaylightAnnotations = (timeseries) => {
    const annotations = {};
    const { lat, lon } = utils.JAEREN_CENTER;

    const days = new Set();
    timeseries.forEach((entry) => {
        days.add(format(new Date(entry.time), 'yyyy-MM-dd'));
    });

    let dayIndex = 0;
    days.forEach((day) => {
        const times = SunCalc.getTimes(new Date(day), lat, lon);
        annotations[`daylight${dayIndex}`] = {
            type: 'box',
            xMin: times.sunrise.getTime(),
            xMax: times.sunset.getTime(),
            backgroundColor: 'rgba(255, 200, 50, 0.15)',
            borderWidth: 0,
        };
        dayIndex++;
    });

    return annotations;
};

const DAY_COLORS = [
    { bg: 'rgba(100, 149, 237, 0.25)', label: '#7B9FFF' },
    { bg: 'rgba(255, 182, 100, 0.25)', label: '#FFB366' },
];

const createDayAnnotation = (dayIndex, xMin, xMax, dayLabel) => ({
    type: 'box',
    xMin,
    xMax,
    backgroundColor: DAY_COLORS[dayIndex % 2].bg,
    borderWidth: 0,
    label: {
        display: true,
        content: dayLabel,
        position: { x: 'center', y: 'start' },
        font: { weight: 'bold', size: 12 },
        color: DAY_COLORS[dayIndex % 2].label,
    },
});

const generateDayAnnotations = (timeseries) => {
    const annotations = {};
    let currentDay = null;
    let dayStart = 0;
    let dayIndex = 0;

    timeseries.forEach((entry, index) => {
        const day = format(new Date(entry.time), 'yyyy-MM-dd');

        if (currentDay !== day) {
            if (currentDay !== null) {
                const label = format(new Date(currentDay), 'EEE d/M');
                annotations[`day${dayIndex}`] = createDayAnnotation(
                    dayIndex, dayStart - 0.5, index - 0.5, label
                );
                dayIndex++;
            }
            currentDay = day;
            dayStart = index;
        }

        if (index === timeseries.length - 1) {
            const label = format(new Date(currentDay), 'EEE d/M');
            annotations[`day${dayIndex}`] = createDayAnnotation(
                dayIndex, dayStart - 0.5, index + 0.5, label
            );
        }
    });

    return annotations;
};

// --- Dataset styling (shared between legend click and dataset builder) ---

const getDatasetStyle = (index, selectedStation) => {
    const color = spotColors[index % spotColors.length];
    const isSelected = selectedStation === null || selectedStation === index;
    const isHighlighted = selectedStation === index;

    return {
        borderColor: isSelected ? color : color + '22',
        backgroundColor: isSelected ? color : color + '22',
        borderWidth: isSelected ? (isHighlighted ? 4 : 2) : 1,
        pointRadius: isSelected ? 5 : 0,
    };
};

// --- Wind direction to color (HSL avoids tan overflow) ---

const windDirectionToColor = (degrees) =>
    `hsl(${degrees}, 70%, 50%)`;

// --- Tooltip label builder ---

const buildTooltipLabel = (tooltipCtx, timeSerie, windSelector) => {
    const station = timeSerie[tooltipCtx.datasetIndex];
    const point = station?.timeseries[tooltipCtx.dataIndex]?.data?.instant?.details;
    if (!point) return '';
    const compass = utils.degToCompass(point.wind_from_direction);
    const knots = (point[windSelector] * utils.MS_TO_KNOTS).toFixed(1);
    return `${station.name} (${compass} ${point.wind_from_direction}°) kn:${knots}`;
};

// --- Zoom/pan config (touch-aware) ---

const buildZoomConfig = (hideDarkHours) => ({
    pan: {
        enabled: true,
        // Desktop: shift+drag to pan. Touch: free pan (no modifier).
        modifierKey: isTouch ? null : 'shift',
        scaleMode: 'x',
        threshold: isTouch ? 12 : 10,
    },
    zoom: {
        drag: {
            enabled: !isTouch, // Desktop only: drag to zoom
        },
        pinch: {
            enabled: true,
        },
        mode: 'x',
        speed: hideDarkHours ? 0.05 : 0.1,
    },
    limits: {
        x: {
            minRange: hideDarkHours ? 5 : undefined,
        },
    },
});

// --- Legend config (display only, station selection is via dropdown) ---

const buildLegendConfig = () => ({
    display: false,
});

// --- Scale configs ---

const buildScales = (hideDarkHours) => ({
    x: hideDarkHours
        ? {
              type: 'category',
              ticks: { maxRotation: 45, minRotation: 45, color: '#ccc' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
          }
        : {
              type: 'time',
              time: {
                  tooltipFormat: 'd/M EEEE HH',
                  displayFormats: { hour: 'EEEE HH' },
              },
              ticks: { color: '#ccc' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
          },
    y: {
        ticks: { color: '#ccc' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
    },
});

// --- Dataset builder ---

const buildDatasets = (timeSerie, chartState) =>
    timeSerie.map((station, index) => ({
        ...getDatasetStyle(index, chartState.selectedStation),
        pointHoverRadius: 10,
        hitRadius: isTouch ? 12 : 4,
        segment: {
            borderColor: chartState.colorFromWindDirection
                ? (ctx) => {
                      const direction =
                          station.timeseries[ctx.p0DataIndex]?.data?.instant
                              ?.details?.wind_from_direction;
                      return direction != null
                          ? windDirectionToColor(direction)
                          : undefined;
                  }
                : undefined,
        },
        label: station.name,
        data: station.timeseries.map(
            (entry) =>
                entry.data.instant.details[chartState.windSelector] *
                utils.MS_TO_KNOTS
        ),
    }));

// --- Loading indicator ---

const showLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.classList.remove('hidden');
};

const hideLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.classList.add('hidden');
};

// --- Main render (full create) — called on init and when scale type changes ---

const createChart = async (chartState) => {
    showLoading();

    try {
        const rawTimeSerie = await utils.getCachedTimeSerie();

        const timeSerie = chartState.hideDarkHours
            ? rawTimeSerie.map((location) => ({
                  ...location,
                  timeseries: utils.filterDaylightHours(location.timeseries),
              }))
            : rawTimeSerie;

        // Store for use in update path
        chartState._timeSerie = timeSerie;
        chartState._rawTimeSerie = rawTimeSerie;

        if (chartState.chart) {
            chartState.chart.destroy();
        }

        const canvasElement = document.getElementById('chart-canvas');
        chartState.chart = new Chart(canvasElement, {
            type: 'line',
            options: {
                maintainAspectRatio: false,
                plugins: {
                    annotation: {
                        annotations: {
                            ...generateWingZoneAnnotations(),
                            ...(chartState.hideDarkHours
                                ? generateDayAnnotations(timeSerie[0].timeseries)
                                : generateDaylightAnnotations(rawTimeSerie[0].timeseries)),
                        },
                    },
                    zoom: buildZoomConfig(chartState.hideDarkHours),
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                buildTooltipLabel(ctx, timeSerie, chartState.windSelector),
                        },
                    },
                    legend: buildLegendConfig(),
                },
                scales: buildScales(chartState.hideDarkHours),
            },
            data: {
                labels: chartState.hideDarkHours
                    ? timeSerie[0].timeseries.map((entry) =>
                          format(new Date(entry.time), 'HH:mm')
                      )
                    : timeSerie[0].timeseries.map((entry) => entry.time),
                datasets: buildDatasets(timeSerie, chartState),
            },
        });
    } catch (error) {
        const el = document.getElementById('loading');
        if (el) el.textContent = `Feil: ${error.message}`;
        return;
    }

    hideLoading();
};

// --- Light update (no destroy) — for wind selector, color mode, station selection ---

const updateChart = (chartState) => {
    const chart = chartState.chart;
    const timeSerie = chartState._timeSerie;
    if (!chart || !timeSerie) return;

    // Update tooltip callback to use current windSelector
    chart.options.plugins.tooltip.callbacks.label = (ctx) =>
        buildTooltipLabel(ctx, timeSerie, chartState.windSelector);

    // Rebuild datasets with new styling/data
    chart.data.datasets = buildDatasets(timeSerie, chartState);
    chart.update('none');
};

// --- Controller setup ---

const populateStationSelector = () => {
    const select = document.querySelector('#stationSelector');
    utils.locations.forEach((location, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = location.name;
        select.appendChild(option);
    });
};

const setupControllers = (chartState, fullRender, lightUpdate) => {
    document.querySelector('#resetZoom').addEventListener('click', () => {
        chartState.chart.resetZoom();
    });

    document.querySelector('#colorFromWindDirection').addEventListener('change', (event) => {
        chartState.colorFromWindDirection = event.target.checked;
        lightUpdate();
    });

    // hideDarkHours changes the x-axis scale type — requires full recreate
    document.querySelector('#hideDarkHours').addEventListener('change', (event) => {
        chartState.hideDarkHours = event.target.checked;
        fullRender();
    });

    document.querySelectorAll('#windtypeselector input[type="radio"]')
        .forEach((radio) => {
            radio.addEventListener('change', (event) => {
                chartState.windSelector = event.target.value;
                lightUpdate();
            });
        });

    populateStationSelector();
    document.querySelector('#stationSelector').addEventListener('change', (event) => {
        chartState.selectedStation = event.target.value === '' ? null : Number(event.target.value);
        lightUpdate();
    });
};

// --- Init ---

const init = async () => {
    const chartState = {
        colorFromWindDirection: false,
        hideDarkHours: false,
        windSelector: 'wind_speed',
        selectedStation: null,
        chart: null,
        _timeSerie: null,
        _rawTimeSerie: null,
    };

    const fullRender = () => createChart(chartState);
    const lightUpdate = () => updateChart(chartState);

    setupControllers(chartState, fullRender, lightUpdate);
    await fullRender();
};

init();
