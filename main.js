import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { format } from 'date-fns';
import SunCalc from 'suncalc';
import * as utils from './utils';

Chart.register(zoomPlugin, annotationPlugin);

// Wing size wind zones (knots) - based on wing foil sizing chart
const wingZones = [
    { size: '5.5m²', min: 12, max: 22, color: 'rgba(76, 175, 80, 0.15)' },   // Green - lightest wind
    { size: '5.0m²', min: 14, max: 25, color: 'rgba(139, 195, 74, 0.15)' },  // Light green
    { size: '4.5m²', min: 18, max: 28, color: 'rgba(205, 220, 57, 0.15)' },  // Lime
    { size: '4.0m²', min: 22, max: 32, color: 'rgba(255, 235, 59, 0.15)' },  // Yellow
    { size: '3.5m²', min: 25, max: 35, color: 'rgba(255, 193, 7, 0.15)' },   // Amber
    { size: '3.0m²', min: 28, max: 38, color: 'rgba(255, 152, 0, 0.15)' },   // Orange
    { size: '2.5m²', min: 30, max: 42, color: 'rgba(255, 87, 34, 0.15)' },   // Deep orange
    { size: '2.0m²', min: 35, max: 45, color: 'rgba(244, 67, 54, 0.15)' },   // Red - strongest wind
];

// Generate wing zone annotations
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

// Generate daylight period annotations for time scale (when showing all hours)
const generateDaylightAnnotations = (timeseries) => {
    const annotations = {};
    const lat = 58.9;
    const lon = 5.6;
    
    // Find unique days in the timeseries
    const days = new Set();
    timeseries.forEach((entry) => {
        days.add(format(new Date(entry.time), 'yyyy-MM-dd'));
    });
    
    // Create a daylight box for each day
    let dayIndex = 0;
    days.forEach((day) => {
        const date = new Date(day);
        const times = SunCalc.getTimes(date, lat, lon);
        
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

// Generate day annotations for alternating background colors (category scale)
const generateDayAnnotations = (timeseries) => {
    const annotations = {};
    let currentDay = null;
    let dayStart = 0;
    let dayIndex = 0;

    timeseries.forEach((entry, index) => {
        const date = new Date(entry.time);
        const day = format(date, 'yyyy-MM-dd');

        if (currentDay !== day) {
            // Close previous day box
            if (currentDay !== null) {
                annotations[`day${dayIndex}`] = {
                    type: 'box',
                    xMin: dayStart - 0.5,
                    xMax: index - 0.5,
                    backgroundColor:
                        dayIndex % 2 === 0
                            ? 'rgba(100, 149, 237, 0.25)'
                            : 'rgba(255, 182, 100, 0.25)',
                    borderWidth: 0,
                    label: {
                        display: true,
                        content: format(new Date(currentDay), 'EEE d/M'),
                        position: { x: 'center', y: 'start' },
                        font: { weight: 'bold', size: 12 },
                        color: dayIndex % 2 === 0 ? '#7B9FFF' : '#FFB366',
                    },
                };
                dayIndex++;
            }
            currentDay = day;
            dayStart = index;
        }

        // Close last day box at the end
        if (index === timeseries.length - 1) {
            annotations[`day${dayIndex}`] = {
                type: 'box',
                xMin: dayStart - 0.5,
                xMax: index + 0.5,
                backgroundColor:
                    dayIndex % 2 === 0
                        ? 'rgba(100, 149, 237, 0.25)'
                        : 'rgba(255, 182, 100, 0.25)',
                borderWidth: 0,
                label: {
                    display: true,
                    content: format(new Date(currentDay), 'EEE d/M'),
                    position: { x: 'center', y: 'start' },
                    font: { weight: 'bold', size: 12 },
                    color: dayIndex % 2 === 0 ? '#7B9FFF' : '#FFB366',
                },
            };
        }
    });

    return annotations;
};

// 20 maximally distinct colors for each spot
const spotColors = [
    '#e6194B', // Red
    '#3cb44b', // Green
    '#4363d8', // Blue
    '#f58231', // Orange
    '#911eb4', // Purple
    '#42d4f4', // Cyan
    '#f032e6', // Magenta
    '#bfef45', // Lime
    '#fabed4', // Pink
    '#469990', // Teal
    '#dcbeff', // Lavender
    '#9A6324', // Brown
    '#fffac8', // Beige
    '#800000', // Maroon
    '#aaffc3', // Mint
    '#808000', // Olive
    '#ffd8b1', // Apricot
    '#000075', // Navy
    '#a9a9a9', // Grey
    '#ffe119', // Yellow
];

const setupControllers = (chartState, renderChartWithState) => {
    document.querySelector('#resetZoom').addEventListener('click', () => {
        chartState.chart.resetZoom();
    });
    const colorFromWindDirectionCheckbox = document.querySelector(
        '#colorFromWindDirection'
    );

    colorFromWindDirectionCheckbox.addEventListener('change', () => {
        chartState.colorFromWindDirection =
            colorFromWindDirectionCheckbox.checked;
        renderChartWithState();
    });

    const hideDarkHoursCheckbox = document.querySelector('#hideDarkHours');
    hideDarkHoursCheckbox.addEventListener('change', () => {
        chartState.hideDarkHours = hideDarkHoursCheckbox.checked;
        renderChartWithState();
    });

    const onWindTypeSelectorClick = (a) => {
        chartState.windSelector = a.target.value;
        renderChartWithState();
    };

    document
        .querySelector('#wind')
        .addEventListener('click', onWindTypeSelectorClick);
    document
        .querySelector('#gust')
        .addEventListener('click', onWindTypeSelectorClick);
    document
        .querySelector('#percentile_90')
        .addEventListener('click', onWindTypeSelectorClick);
    document
        .querySelector('#percentile_10')
        .addEventListener('click', onWindTypeSelectorClick);
};

const renderChart = async (chartState) => {
    chartState.chart && chartState.chart.destroy();
    const rawTimeSerie = await utils.getCachedTimeSerie();
    
    // Filter to daylight hours if enabled
    const timeSerie = chartState.hideDarkHours
        ? rawTimeSerie.map((location) => ({
              ...location,
              timeseries: utils.filterDaylightHours(location.timeseries),
          }))
        : rawTimeSerie;
    
    const ctx = document.getElementById('chart-canvas');
    chartState.chart = new Chart(ctx, {
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
                zoom: {
                    pan: {
                        enabled: true,
                        modifierKey: 'shift',
                        scaleMode: 'x',
                    },
                    zoom: {
                        drag: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: 'x',
                        // Slower zoom speed for category scale (daylight filter)
                        speed: chartState.hideDarkHours ? 0.05 : 0.1,
                    },
                    limits: {
                        x: {
                            // Minimum 5 data points visible when using category scale
                            minRange: chartState.hideDarkHours ? 5 : undefined,
                        },
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) =>
                            timeSerie[ctx.datasetIndex].name +
                            ' (' +
                            utils.degToCompass(
                                timeSerie[ctx.datasetIndex].timeseries[
                                    ctx.dataIndex
                                ].data.instant.details.wind_from_direction
                            ) +
                            ' ' +
                            timeSerie[ctx.datasetIndex].timeseries[
                                ctx.dataIndex
                            ].data.instant.details.wind_from_direction +
                            ') kn:' +
                            (
                                timeSerie[ctx.datasetIndex].timeseries[
                                    ctx.dataIndex
                                ].data.instant.details[
                                    chartState.windSelector
                                ] * 1.9438452
                            ).toFixed(1),
                    },
                },
                legend: {
                    labels: {
                        color: '#ccc',
                    },
                    onHover: (event, legendItem, legend) => {
                        const chart = legend.chart;
                        const hoveredIndex = legendItem.datasetIndex;
                        chart.data.datasets.forEach((dataset, index) => {
                            const originalColor = spotColors[index % spotColors.length];
                            if (index === hoveredIndex) {
                                dataset.borderColor = originalColor;
                                dataset.backgroundColor = originalColor;
                                dataset.borderWidth = 4;
                            } else {
                                dataset.borderColor = originalColor + '22';
                                dataset.backgroundColor = originalColor + '22';
                                dataset.borderWidth = 1;
                            }
                        });
                        chart.update('none');
                    },
                    onLeave: (event, legendItem, legend) => {
                        const chart = legend.chart;
                        chart.data.datasets.forEach((dataset, index) => {
                            const originalColor = spotColors[index % spotColors.length];
                            dataset.borderColor = originalColor;
                            dataset.backgroundColor = originalColor;
                            dataset.borderWidth = 2;
                        });
                        chart.update('none');
                    },
                },
            },
            scales: {
                x: chartState.hideDarkHours
                    ? {
                          type: 'category',
                          ticks: {
                              maxRotation: 45,
                              minRotation: 45,
                              color: '#ccc',
                          },
                          grid: {
                              color: 'rgba(255, 255, 255, 0.1)',
                          },
                      }
                    : {
                          type: 'time',
                          time: {
                              tooltipFormat: 'd/M EEEE HH',
                              displayFormats: {
                                  hour: 'EEEE HH',
                              },
                          },
                          ticks: {
                              color: '#ccc',
                          },
                          grid: {
                              color: 'rgba(255, 255, 255, 0.1)',
                          },
                      },
                y: {
                    ticks: {
                        color: '#ccc',
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                },
            },
        },
        data: {
            labels: chartState.hideDarkHours
                ? timeSerie[0].timeseries.map((x) =>
                      format(new Date(x.time), 'HH:mm')
                  )
                : timeSerie[0].timeseries.map((x) => x.time),
            datasets: timeSerie.map((y, index) => ({
                pointRadius: 5,
                pointHoverRadius: 10,
                borderWidth: 2,
                borderColor: spotColors[index % spotColors.length],
                backgroundColor: spotColors[index % spotColors.length],
                segment: {
                    borderColor: chartState.colorFromWindDirection
                        ? (ctx) =>
                              `rgb(${
                                  (Math.sin(
                                      y.timeseries[ctx.p0DataIndex].data.instant
                                          .details.wind_from_direction /
                                          (365 / 3)
                                  ) +
                                      1) *
                                  (255 / 2)
                              }, ${
                                  (Math.cos(
                                      y.timeseries[ctx.p0DataIndex].data.instant
                                          .details.wind_from_direction /
                                          (365 / 3)
                                  ) +
                                      1) *
                                  (255 / 2)
                              }, ${
                                  (Math.tan(
                                      y.timeseries[ctx.p0DataIndex].data.instant
                                          .details.wind_from_direction /
                                          (365 / 3)
                                  ) +
                                      1) *
                                  (255 / 2)
                              })`
                        : undefined,
                },
                label: y.name,
                data: y.timeseries.map(
                    (x) =>
                        x.data.instant.details[chartState.windSelector] *
                        1.9438452
                ),
            })),
        },
    });
};

const init = async () => {
    const chartState = {
        colorFromWindDirection: false,
        hideDarkHours: false,
        windSelector: 'wind_speed',
        chart: null,
    };
    const renderChartWithState = renderChart.bind(null, chartState);
    setupControllers(chartState, renderChartWithState);
    renderChartWithState();
};
init();
