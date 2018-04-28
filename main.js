const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const mqtt = require('mqtt').connect('mqtt://nms.iptime.org:23');

let window;
var current_eui;

// mqtt broker에 연결되면 노드와 관련된 모든 토픽을 구독
mqtt.on('connect', () => {
    log('mqtt connected and subscribing node/#');
    mqtt.subscribe('node/#');
})

// broker로부터 구독하는 토픽이 도착하면 
mqtt.on('message', (topic, payload) => {
    if(topic.includes('req')) return;
    log(`[App <-- (mqtt) <-- broker] ${topic} ${String(payload)}`);

    // 현재 broker 연결된 노드의 eui 정보 -> GUI의 eui select에 추가
    if(topic === 'node/all/res') window.webContents.send('res', 'eui', String(payload));    
    // 특정 노드의 응답 메시지 (전송 완료 / 네트워크 연결 상태) -> 추가 전송 여부 확인 / LoRa 네트워크 조인 상태 확인
    if(topic === `node/${current_eui}/res`) {
        if(String(payload) === 'TX DONE') {
            window.webContents.send('res', 'txdone', 'true');       // RSSI from the node or NOACK
            log('[App --> (ipc) --> Renderer] txdone true');
        }
        if(String(payload).includes('status')) {
            var status = String(payload).includes('true') ? 'ON' : 'OFF';
            window.webContents.send('res', 'status', status);
            log(`[App --> (ipc) --> Renderer] status ${status}`);
        }
    }

    // 게이트웨이의 패킷 수신 메시지 -> 렌더러에서 캔버스에 rssi 값 plot
    if(topic === `lora/${current_eui}/up`) {
        p = JSON.parse(payload);
        rssi = p.rssi;
        lsnr = p.lsnr;
        window.webContents.send('res', 'rssi', rssi);
        log(`[App --> (ipc) --> Renderer] rssi ${rssi} lsnr ${lsnr}`);
    }
})

app.on('ready', () => {
    create();
    window.on('closed', () => { window = null; })
});

app.on('activate', () => {if(window == null) create(); });
app.on('window-all-closed', () => {if(process.platform !== 'darwin') app.quit();})

function create() {
    window = new BrowserWindow({ width: 1280, height: 480, resizable: true });
    window.loadURL(`file://${__dirname}/index.html`);
}

ipcMain.on('req', (event, payload) => {
    if(payload === 'eui') {
        mqtt.publish('node/all/req', 'eui');
        log('[App --> (mqtt) --> broker] node/all/req eui');
    }
})

ipcMain.on('message', (event, payload) => {
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, payload);
    log(`[App --> (mqtt) --> broker] ${topic} ${payload}`);
}); 

ipcMain.on('join', () => {
    if(current_eui === undefined) {
        log(`eui undefined, connect a node to the broker`);
        return;
    } 
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, 'join');
    log(`[App --> (mqtt) --> broker] ${topic} join`);
})

ipcMain.on('reset', () => {
    if(current_eui === undefined) {
        log(`eui undefined, connect a node to the broker`);
        return;
    }   
    topic = `node/${current_eui}/req`;
    mqtt.publish(topic, 'reset');
    log(`[App --> (mqtt) --> broker]', ${topic} reset`);  
})

// eui select를 이용해 mqtt topic 변경
ipcMain.on('topic', (event, topic) => {
    current_eui = topic;
    topic = `node/${topic}/req`;
    mqtt.publish(topic, 'status');
    log(`[App --> (mqtt) --> broker] ${topic} status`);  
    
    mqtt.subscribe(`lora/${current_eui}/up`);    
    log(`subscribing lora/${current_eui}/up`);  
});

function log(str) {
    console.log(str);
    window.webContents.send('log', str);
}