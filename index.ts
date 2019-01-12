import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { AddressInfo } from 'net';

import {
    EventName, HttpFsServer, IFileResolvedEventArgs, IRequestArrivedEventArgs, IResponseSent, IServerConfig
} from './http-fs-server';

export class App {

    async start(): Promise<{ httpFsServer: HttpFsServer, address: AddressInfo }> {
        const args = process.argv.slice(2);
        const appConfig = this.getConfig(args);
        const serverConfig = this.createServerConfigWithDefaults(appConfig.serverConfig);
        const httpFsServer = new HttpFsServer(serverConfig);
        const httpServer = await httpFsServer.start();
        return { httpFsServer: httpFsServer, address: httpServer.address() as AddressInfo };
    }

    private getConfig(args: string[]): IAppConfig {
        const config = <IAppConfig>{
            serverConfig: <IServerConfig>{}
        };
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--path') {
                config.serverConfig.path = this.resolveEnvironmentVariables(args[++i]);
            } else if (arg === '--default-file-name') {
                config.serverConfig.defaultFileName = args[++i];
            } else if (arg === '--use-ssl') {
                config.serverConfig.useSsl = true;
            } else if (arg === '--ssl-cert-file') {
                config.serverConfig.sslCertFile = args[++i];
            } else if (arg === '--ssl-key-file') {
                config.serverConfig.sslKeyFile = args[++i];
            } else if (arg === '--host') {
                config.serverConfig.host = args[++i];
            } else if (arg === '--port') {
                config.serverConfig.port = +args[++i];
            } else if (arg === '--mime-map') {
                config.serverConfig.mimeMap = JSON.parse(args[++i]);
            } else if (arg === '--mime-map-file') {
                const mimeMapFile = this.resolveEnvironmentVariables(args[++i]);
                config.serverConfig.mimeMap = JSON.parse(readFileSync(mimeMapFile).toString());
            } else if (arg === '--log-events') {
                config.logEvents = true;
            } else {
                throw new Error(`Unknown argument ${arg}`);
            }
        }
        return config;
    }

    private createServerConfigWithDefaults(baseConfig: IServerConfig): IServerConfig {
        const sourceConfig = baseConfig || {};
        const inferredDefaultPort = sourceConfig.useSsl ? 443 : 80;
        const config: IServerConfig = {
            defaultFileName: sourceConfig.defaultFileName || 'index.html',
            host: sourceConfig.host || '127.0.0.1',
            mimeMap: sourceConfig.mimeMap,
            path: sourceConfig.path || '.',
            port: baseConfig.port || inferredDefaultPort,
            sslCertFile: sourceConfig.sslCertFile || '',
            sslKeyFile: sourceConfig.sslKeyFile || '',
            useSsl: sourceConfig.useSsl || false
        };
        return config;
    }

    private resolveEnvironmentVariables(value: string): string {
        if (!value) {
            return value;
        }
        const replaced = value.replace(/%([^%]+)%/g, (foundSubstring: string, ...args: any[]) => {
            return <string>process.env[args[0]];
        });
        return replaced;
    }
}

const app = new App();
app.start().then(obj => {
    if (obj.httpFsServer.eventEmitter) {
        attachToEvents(obj.httpFsServer.eventEmitter);
    }
    logMessage(`Listening on ${obj.address.address}:${obj.address.port}`);
}).catch(err => {
    logError('Start failed: ', err);
});

function attachToEvents(httpFsServerEventEmitter: EventEmitter): void {
    httpFsServerEventEmitter.on(EventName.requestArrived, data => {
        const eventData = <IRequestArrivedEventArgs>data;
        logMessage(`${EventName.requestArrived} : ${eventData.request.method} ${eventData.request.url}`);
    });
    httpFsServerEventEmitter.on(EventName.fileResolved, data => {
        const eventData = <IFileResolvedEventArgs>data;
        logMessage(`${EventName.fileResolved} : ${eventData.path} (${eventData.contentType})`);
    });
    httpFsServerEventEmitter.on(EventName.reponseSent, data => {
        const eventData = <IResponseSent>data;
        logMessage(`${EventName.reponseSent} : finished for ${eventData.duration} ms : ${eventData.request.url}`);
    });
}

function logError(text: string, err?: Error): void {
    let errMessage = '';
    let errStack = '';
    if (err) {
        errMessage = err.message;
        errStack = err.stack || '';
    }
    process.stderr.write(`${text} ${errMessage} ${errStack}\n`);
}

function logMessage(text: string): void {
    process.stdout.write(`${getDateAsString()} : ${text}\n`);
}

function getDateAsString(): string {
    const date = new Date().toISOString();
    return date;
}

interface IAppConfig {
    serverConfig: IServerConfig;
    logEvents: boolean;
}
