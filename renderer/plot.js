const Chart = require('chart.js');

exports.create = (type) => {
    if(type === 'line') return create_line_chart();
    else if(type === 'hist') return create_hist_chart();
}

function create_line_chart() {
    const config = { 
		type: 'line', 
		data: {
			datasets: [ 
				{ label: 'Raw data', fill: false, backgroundColor: 'rgb(255, 99, 132)', borderColor: 'rgb(255, 99, 132)' },
				{ label: 'Avg data', fill: false, backgroundColor: 'rgb(99, 132, 255)', borderColor: 'rgb(99, 132, 255)', borderDash: [5, 5] },
			]
		},
		options: {
			tooltips: { mode: 'index', intersect: false }, hover: { mode: 'index', intersect: false },
        },
    }
    canvas = document.createElement('canvas');
    var chart = new Chart(canvas.getContext('2d'), config);
    chart.rssi = { mean: 0, std: 0, max: 0, min: 0, ns: 0, nr: 0 }
    chart.add = (label, value) => {
        labels = chart.data.labels;
        datasets = chart.data.datasets;

        chart.rssi.nr += 1;
        if(labels.length > 30) {
            labels.shift();
            datasets[0].data.shift();
            datasets[1].data.shift();
        }
        labels.push(label); 
        datasets[0].data.push(value);
        
        // 통계 값 계산
        var stat = ari_calc(datasets[0].data);
        chart.rssi.mean = stat.mean;
        chart.rssi.std = stat.std;
        chart.rssi.max = stat.max;
        chart.rssi.min = stat.min;
        datasets[1].data.push(stat.mean);

        chart.update();
    };
    return chart;
}

function create_hist_chart() {
    const labels = [];
    const data = [];
    for(i=0; i<128; i++) { 
        labels.push(-127+i);
        data.push(0);
    }
    
    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'histogram', backgroundColor: 'rgb(255, 99, 132)', borderColor: 'rgb(255, 99, 132)', data: data }]
        },
        options: {responsive: true},
        max: -127,
        min: 0
    }
    canvas = document.createElement('canvas');
    var chart = new Chart(canvas.getContext('2d'), config);
    chart.rssi = { mean: 0, std: 0, max: 0, min: 0, ns: 0, nr: 0 }
    chart.add = (label, value) => {
        var index = chart.data.labels.indexOf(value);
        chart.data.datasets[0].data[index] += 1;

        var stat = geo_calc(chart.data.datasets[0].data, labels);
        chart.rssi.mean = stat.mean;
        chart.rssi.std = stat.std;
        chart.rssi.max = stat.max;
        chart.rssi.min = stat.min;
        chart.update();
    }

    return chart;
}

function ari_calc(data) {
    var result = {mean: 0, std: 0, max: 0, min: 0};
    const N = data.length;

    // 평균 값
    for(i=0; i<N; i++) result.mean += data[i]/N;

    // 표준 편차
    if(N == 1) result.std = 0;
    else if(N > 1) for(i=0; i<N; i++) result.std += ((data[i] - result.mean) ** 2) / (N-1);

    result.std = Math.sqrt(result.std);
    
    // 최댓값, 최솟값
    result.max = Math.max.apply(null, data);
    result.min = Math.min.apply(null, data);
    
    return result;
}

function geo_calc(data, labels) {
    var result = {mean: 0, std: 0, max: 0, min: 0};
    var tmp = 0;
    const N = data.length;
    const den = data.reduce((a, b)=> { return a+b });
    console.log(den);

    // 평균 값
    for(i=0; i<N; i++) result.mean += (labels[i] * data[i])/den;

    // 표준 편차
    if(den > 1) {
        for(i=0; i<N; i++) result.std += (labels[i] ** 2) * data[i] / den;
        result.std = (result.std - (result.mean ** 2)) * den / (den-1);
        result.std = Math.sqrt(result.std);
    }

    // 최댓값, 최솟값
    for(i=127; i>0; i--) if(data[i] > 0) {
        result.max = labels[i];
        break;
    }
    for(i=0; i<128; i++) if(data[i] > 0) {
        result.min = labels[i];
        break;
    }
    
    return result;
}