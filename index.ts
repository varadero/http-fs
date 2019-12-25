import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { AddressInfo } from 'net';

import {
    EventName, HttpFsServer, IFileResolvedEventArgs, IRequestArrivedEventArgs, IResponseSent, IServerConfig
} from './http-fs-server';

export class App {

    private defaults = {
        serve: {
            defaultFileName: 'index.html',
            host: '127.0.0.1',
            httpPort: 80,
            httpsPort: 443,
            path: '.'
        },
        ssl: {
            sslCertFile: 'cert.pem',
            sslKeyFile: 'key.pem'
        }
    };

    async start(): Promise<IStartResult> {
        const args = process.argv.slice(2);
        const appConfig = this.createConfig(args);
        const serverConfig = this.createServerConfigWithDefaults(appConfig.serverConfig);
        const httpFsServer = new HttpFsServer(serverConfig);
        const httpServer = await httpFsServer.start();
        const result: IStartResult = {
            address: httpServer.address() as AddressInfo,
            appConfig: appConfig,
            httpFsServer: httpFsServer,
            serverConfig: serverConfig
        };
        return result;
    }

    private createConfig(args: string[]): IAppConfig {
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
        const inferredDefaultPort = sourceConfig.useSsl ? this.defaults.serve.httpsPort : this.defaults.serve.httpPort;
        const config: IServerConfig = {
            defaultFileName: sourceConfig.defaultFileName || this.defaults.serve.defaultFileName,
            host: sourceConfig.host || this.defaults.serve.host,
            mimeMap: sourceConfig.mimeMap,
            path: sourceConfig.path || this.defaults.serve.path,
            port: baseConfig.port || inferredDefaultPort,
            sslCertFile: sourceConfig.sslCertFile || this.defaults.ssl.sslCertFile,
            sslKeyFile: sourceConfig.sslKeyFile || this.defaults.ssl.sslKeyFile,
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
    if (obj.appConfig.logEvents) {
        attachToEvents(obj.httpFsServer.eventEmitter);
    }
    logMessage(`Listening on ${obj.address.address}:${obj.address.port}`);
    logMessage(`Serving path '${obj.serverConfig.path}' resolved to '${obj.httpFsServer.resolvedPath}'`);
    logMessage(`App config ${JSON.stringify(obj.appConfig)}`);
    logMessage(`Server config ${JSON.stringify(obj.serverConfig)}`);
}).catch(err => {
    logError('Start failed: ', err);
});

function attachToEvents(httpFsServerEventEmitter: EventEmitter): void {
    httpFsServerEventEmitter.on(EventName.requestArrived, data => {
        const eventData = <IRequestArrivedEventArgs>data;
        logMessage(`${EventName.requestArrived} : ${eventData.request.method} ${eventData.request.url}` +
            ` (requestId ${eventData.requestId})`);
    });
    httpFsServerEventEmitter.on(EventName.fileResolved, data => {
        const eventData = <IFileResolvedEventArgs>data;
        logMessage(`${EventName.fileResolved} : ${eventData.path} (${eventData.contentType})` +
            ` (requestId ${eventData.requestId})`);
    });
    httpFsServerEventEmitter.on(EventName.reponseSent, data => {
        const eventData = <IResponseSent>data;
        logMessage(`${EventName.reponseSent} : finished for ${eventData.duration} ms : ${eventData.request.url}` +
            ` (requestId ${eventData.requestId})`);
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

interface IStartResult {
    httpFsServer: HttpFsServer;
    address: AddressInfo;
    appConfig: IAppConfig;
    serverConfig: IServerConfig;
}
