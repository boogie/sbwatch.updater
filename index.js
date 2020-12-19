class Logger {
    constructor(id) {
        this._id = id;
        this._el = document.getElementById(this._id);
    }
    info(message) {
        const time = new Date().toISOString();
        this._el.innerHTML += `<p class="info"><span class="time">${time}</span> - <span class="message">${message}</span></p>`;
    }
    error(message) {
        const time = new Date().toISOString();
        this._el.innerHTML += `<p class="error"><span class="time">${time}</span> - <span class="message">${message}</span></p>`;
    }
}

class SBWatch {
    constructor(di = {}) {
        this.MAIN_SERVICE_UUID = 0x6006;
        this.OTA_SERVICE_UUID = '00010203-0405-0607-0809-0a0b0c0d1912';
        this.OTA_CHARACTERISTIC_UUID = '00010203-0405-0607-0809-0a0b0c0d2b12';
        this._logger = di.logger || { info: () => {}, error: () => {} };
        this._otaCharacteristic = null;
        this._connectCallback = null;
        this._connectingCallback = null;
        this._disconnectCallback = null;
        this._messageCallback = null;
    }
    onConnecting(callback) {
        this._connectingCallback = callback;
        return this;
    }
    onConnect(callback) {
        this._connectCallback = callback;
        return this;
    }
    onDisconnect(callback) {
        this._disconnectCallback = callback;
        return this;
    }
    async connect() {
        try {
            const device = await this._requestDevice();
            document.getElementById('device-name').innerHTML = device.name;
            device.addEventListener('gattserverdisconnected', this._disconnected.bind(this));
            if (this._connectingCallback) this._connectingCallback();
            this._logger.info(`Connecting to your watch...`);
            const server = await device.gatt.connect();
            this._logger.info(`Watch server connected.`);
            const service = await server.getPrimaryService(this.OTA_SERVICE_UUID);
            this._logger.info(`Watch service connected.`);
            this._otaCharacteristic = await service.getCharacteristic(this.OTA_CHARACTERISTIC_UUID);
            this._logger.info(`Watch characteristic connected.`);
        } catch (error) {
            this._logger.error(`${error.message}`);
            this._disconnected();
            return;
        }
        await this._connected();
    }
    async _requestDevice() {
        return navigator.bluetooth.requestDevice({
            optionalServices: [this.MAIN_SERVICE_UUID, this.OTA_SERVICE_UUID],
            acceptAllDevices: true
        });
    }
    async _connected() {
        this._logger.info('Ready for the update.');
        if (this._connectCallback) this._connectCallback();
        this.uploadFirmware(firmwareArray);
    }
    async _disconnected() {
        this._logger.info('Watch disconnected.');
        document.getElementById('device-name').innerHTML = 'SBWatch';
        if (this._disconnectCallback) this._disconnectCallback();
    }
    async sendOTAData(data) {
        await this._otaCharacteristic.writeValue(Uint8Array.from(data));
    }
    async readOTAData() {
        return await this._otaCharacteristic.readValue();
    }
    async uploadFirmware(firmwareArray) {
        this._logger.info('Starting OTA update.');
        const percent = Math.floor(firmwareArray.length / 100);
        for (let index = 0; index < firmwareArray.length; index++) {
            await this.sendOTAData(firmwareArray[index]);
            if (index % 64 === 0) {
                await this.readOTAData();
            }
            if (index % percent === 0) {
                document.getElementById('percent').innerHTML = `Uploading... (${index / percent}%)`;
            }
        }
        this._logger.info('OTA Update DONE.');
    }
}

const logger = new Logger('log');
const watch = new SBWatch({ logger });

document.getElementById('connect-button').addEventListener('click', async () => {
    await watch.connect();
});

logger.info('Initialization complete. Please connect your watch.');
