const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const mqtt = require('mqtt').connect('mqtt://nms.iptime.org:23');
const fs = require('fs');

let window;
var current_eui;

// mqtt broker에 연결되면 노드와 관련된 모든 토픽을 구독
mqtt.on('connect', () => {
    console.log('mqtt connected and is subscribing node/#');
    mqtt.subscribe('node/#');
})

// broker로부터 구독하는 토픽이 도착하면 
mqtt.on('message', (topic, payload) => {
    if(topic.includes('req')) return;
    console.log('[App <-- (mqtt) <-- broker]', topic, String(payload));

    // 현재 broker 연결된 노드의 eui 정보 -> GUI의 eui select에 추가
    if(topic === 'node/all/res') window.webContents.send('eui', String(payload));    

    // 특정 노드의 응답 메시지 (전송 완료 / 네트워크 연결 상태) -> 추가 전송 여부 확인 / LoRa 네트워크 조인 상태 확인
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

    // 게이트웨이의 패킷 수신 메시지 -> 렌더러에서 캔버스에 rssi 값 plot
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
    window = new BrowserWindow({ width: 1400, height: 480, resizable: true });
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