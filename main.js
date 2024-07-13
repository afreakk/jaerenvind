import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import * as utils from './utils';

Chart.register(zoomPlugin);

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
    const timeSerie = await utils.getCachedTimeSerie();
    const ctx = document.getElementById('chart-canvas');
    chartState.chart = new Chart(ctx, {
        type: 'line',
        options: {
            maintainAspectRatio: false,
            plugins: {
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
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        tooltipFormat: 'd/M EEEE HH',
                        displayFormats: {
                            hour: 'EEEE HH',
                        },
                    },
                },
            },
        },
        data: {
            labels: timeSerie[0].timeseries.map((x) => x.time),
            datasets: timeSerie.map((y) => ({
                pointRadius: 5,
                pointHoverRadius: 10,
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
        windSelector: 'wind_speed',
        chart: null,
    };
    const renderChartWithState = renderChart.bind(null, chartState);
    setupControllers(chartState, renderChartWithState);
    renderChartWithState();
};
init();
