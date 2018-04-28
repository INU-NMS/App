// load modules
const { remote, ipcRenderer } = require('electron');
const fs = require('fs');
const Menu = require('./renderer/menu').createMenu(remote, ipcRenderer);
const plot = require('./renderer/plot');

// load html components and add event listeners
const button = document.getElementById('btnSend');
button.addEventListener('click', send);
const select = document.getElementById('euiList');
select.addEventListener('change', addEUI);
const logArea = document.getElementById('logArea');

// global variables
var isConnected = false;
var isSending = false;
var logger;
var test = false;

// initiate rendering
var line = plot.create('line');
div = document.createElement('div');
div.classList.add('chart-container');
div.appendChild(line.canvas);
document.querySelector('.container').appendChild(div);

var hist = plot.create('hist');
div = document.createElement('div');
div.classList.add('chart-container');
div.appendChild(hist.canvas);
document.querySelector('.container').appendChild(div);

ipcRenderer.send('req', 'eui');

ipcRenderer.on('res', (event, topic, payload) => {
	console.log('res', topic, payload);
	if(topic === 'eui') addEUI(payload);
	if(topic === 'status') setStatus(payload);
	if(topic === 'rssi') setRSSI(payload);
	if(topic === 'txdone') txDone();
});

function addEUI(eui) {
	item = document.createElement('option');
	item.setAttribute('value', eui);
	item.appendChild(document.createTextNode(eui));
	select.appendChild(item);
	setEUI();
}

function setStatus(status) {
	document.getElementById('status').innerHTML = status;
	if(status === 'ON') isConnected = true;
	else isConnected = false;
}

function txDone() {
	line.rssi.ns += 1;
	document.getElementById('st_recv1').innerHTML = `(${line.rssi.nr} / ${line.rssi.ns})`;

	count = document.getElementById('count');
	count.value = count.value - 1;
	if(count.value > 0) {
		ipcRenderer.send('message', 'send');
		return;
	}
	isSending = false;
	count.value = 100;
	button.innerHTML = "전송";

	log('stop sending');
	logger.write('\n');
	logger.close();
}

function setRSSI(rssi) {
	logger.write(`${rssi}\t`);
	
	document.getElementById('pdr').innerHTML = (line.rssi.nr/line.rssi.ns).toFixed(2);
	line.add('', rssi);
	hist.add('', rssi);

	document.getElementById('st_mean1').innerHTML = line.rssi.mean.toFixed(2);
	document.getElementById('st_std1').innerHTML = line.rssi.std.toFixed(2);
	document.getElementById('st_max1').innerHTML = line.rssi.max.toFixed(2);
	document.getElementById('st_min1').innerHTML = line.rssi.min.toFixed(2);
	document.getElementById('st_mean2').innerHTML = hist.rssi.mean.toFixed(2);
	document.getElementById('st_std2').innerHTML = hist.rssi.std.toFixed(2);
	document.getElementById('st_max2').innerHTML = hist.rssi.max.toFixed(2);
	document.getElementById('st_min2').innerHTML = hist.rssi.min.toFixed(2);	
}

ipcRenderer.on('log', (event, str)=> {
	log(str);
});

function log(str) {
	logArea.innerHTML += `${str}\n`;
	logArea.scrollTop = logArea.scrollHeight;
}

function ipcSend(str) {
	ipcRenderer.send('message', str);
}

// html components event handler
function send() {
	if(isConnected == false) {
		log('cannot transmit LoRa frame');
		return;
	}

	var x = document.getElementById('count');
	if(x.value <= 0) return;
	if(isSending == false) {
		isSending = true;
		var eui = select.value;
		var header = String(new Date()).replace(/ /gi, '/');
		logger = fs.createWriteStream(`${eui}.csv`, {flags: 'a'});
		logger.write(`${header}\t`);
		log(`start logging since ${header}`);

		setTimeout(ipcSend, 0, `power=${document.getElementById('power').value}`);
		setTimeout(ipcSend, 150, `datarate=${document.getElementById('datarate').value}`);
		setTimeout(ipcSend, 300, `length=${document.getElementById('length').value}`);
		setTimeout(ipcSend, 450, 'send');			
		button.innerHTML = "정지";
	} else {
		isSending = false;
		log('stop logging');
		x.value = 100;
		button.innerHTML = "전송";
		logger.write('\n');
		logger.close();
	}
}

function setEUI() {
	ipcRenderer.send('topic', select.value);
}

// 24시간 측정용
if(test){
	button.removeEventListener('click', send);
	button.addEventListener('click', timeout);
	var num_measure = 0;
	var timer;

	function timeout() {
		 var x = 60 - new Date().getMinutes();
		 console.log(`남은시간%d`, x);
		 if(x>=55) measure24h();
		 else setTimeout(measure24h, x*1000*60);
	}

	function measure24h() {
		button.disabled = true;
		timer = setInterval(measure, 1000*60*60);
		
		send();
		measure();
	}

	function measure() {
		document.getElementById('count').value=1000000;
		num_measure += 1;
		logger.write(`\n${ String(new Date()).replace(/ /gi, '/') }\t`);

		if(num_measure == 24) {
			clearInterval(timer);
			button.disabled = false;
			logger.write('\n');
			logger.close();
			document.getElementById('count').value=0
			console.log('측정 완료');
		}
	}
}
