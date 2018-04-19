const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const mqtt = require('mqtt').connect('mqtt://nms.iptime.org:8080');
const fs = require('fs');
const recorder = require('./recorder');

//const recognizer = require('./recognizer');
//const synthesizer = require('./synthesizer');

let window;
var current_eui;

mqtt.on('connect', () => {
    mqtt.subscribe('node/#');
    console.log('mqtt connected and is subscribing node/#');
    //synthesizer.synthesize('아구아구아구아구아구아구', 'kr');
})

mqtt.on('message', (topic, payload) => {
    console.log('[App <-- (mqtt) <-- broker]', topic, String(payload));
    if(topic === 'node/all/res') window.webContents.send('eui', String(payload));    
    
    if(topic === `node/${current_eui}/res`) {
        if(String(payload) === 'TX DONE') {
            window.webContents.send('txdone', 'true');
            console.log('[App --> (ipc) --> Renderer]', 'txdone', 'true');
        }
        if(String(payload).includes('status')) {
            var val = String(payload).includes('true') ? 'true' : 'false';
            window.webContents.send('status', val);
            console.log('[App --> (ipc) --> Renderer]', 'status', val);
        }
    }

    if(topic === `lora/${current_eui}/up`) {
        p = JSON.parse(payload);
        rssi = p.rssi;
        lsnr = p.lsnr;
        window.webContents.send('rssi', rssi);
        console.log('[App --> (ipc) --> Renderer]', 'rssi', rssi, 'lsnr', lsnr);
    }
})

app.on('ready', () => {
    create();
    window.on('closed', () => { window = null; })
});

app.on('activate', () => {if(window == null) create(); });
app.on('window-all-closed', () => {if(process.platform !== 'darwin') app.quit();})

function create() {
    window = new BrowserWindow({ width: 1500, height: 480, resizable: true });
    window.loadURL(`file://${__dirname}/index.html`);
}

ipcMain.on('message', (event, payload) => {
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, payload);
    console.log('[App --> (mqtt) --> broker]', topic, payload);
}); 

ipcMain.on('join', () => {
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, 'join');
    console.log('[App --> (mqtt) --> broker]', topic, 'join');  
})

ipcMain.on('done', (event, rssi) => {
    var mean = rssi.mean.toFixed(2);
    var std = rssi.std.toFixed(2);
    //synthesizer.synthesize(`전송 완료 평균 ${mean} 표준편차 ${std}`, 'kr');
})

ipcMain.on('reset', () => {
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, 'reset');
    console.log('[App --> (mqtt) --> broker]', topic, 'reset');  
})

// eui select를 이용해 mqtt topic 변경
ipcMain.on('topic', (event, topic) => {
    current_eui = topic;
    topic = `node/${topic}/req`;
    mqtt.publish(topic, 'status');
    console.log('[App --> (mqtt) --> broker]', topic, 'status');  
    
    mqtt.subscribe(`lora/${current_eui}/up`);    
    console.log('subscribing', `lora/${current_eui}/up`);  
});

ipcMain.on('eui', () => {
    // request eui
    mqtt.publish('node/all/req', 'eui');
    console.log('[App --> (mqtt) --> broker]', 'node/all/req', 'eui');
})

ipcMain.on('debug', (event, log) => {
    console.log('[DEBUG]', log);
})

//record();

function record() {
    recorder.record().then(function(result){
        console.log(result);
        if(result == 'stop') {
            recognizer.recognize().then(function(transcription) {
                process(transcription);
            }).then(record);
        }
    });
}

function process(transcription) {
    synthesizer.synthesize(transcription, 'kr');
    if(transcription.includes("전송")) {
        synthesizer.synthesize('전송합니다.', 'kr');
        window.webContents.send('gsr', '전송');
    }
    if(transcription.includes("다시") || transcription.includes("재시작")) {
        synthesizer.synthesize('리셋합니다.', 'kr');
        app.relaunch();
    }
}
