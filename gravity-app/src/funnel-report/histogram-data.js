export function histogramData(block, summary, maxCount) {
  return {
    chart: {margin: {top: 26, right: 16, bottom: 8, left: 8}},
    legend: {enabled: false},
    tooltip: {enabled: true, valueFormat: {type: 'number', precision: 0}},
    xAxis: {
      type: 'category', categories: summary.bins.map(bin => bin.range),
      labels: {autoRotation: false},
    },
    yAxis: [{
      type: 'linear', min: 0, max: maxCount,
      labels: {numberFormat: {precision: 0}}, grid: {enabled: true},
    }],
    series: {data: [{
      type: 'bar-x', name: 'Команды',
      color: block.code === 'attract' ? '#7bb8e0' : '#73c7b5',
      borderRadius: 3, dataLabels: {enabled: true, inside: false},
      data: summary.bins.map((bin, index) => ({x: index, y: bin.count, label: String(bin.count)})),
    }]},
  };
}
