import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { AddressInfo } from 'net';

import {
    EventName, HttpFsServer, IFileResolvedEventArgs, IRequestArrivedEventArgs, IResponseSent, IServerConfig
} from './http-fs-server';

export class App {

    private readonly defaults = {
        serve: {
            defaultFileName: 'index.html',
            host: '127.0.0.1',
            httpPort: 80,
            httpsPort: 443,
            path: '.'
        }
    };

    async start(): Promise<IStartResult> {
        const args = process.argv.slice(2);
        const argErrors = this.getArgumentsErrors(args);
        if (argErrors.length > 0) {
            return {
                errors: argErrors
            } as IStartResult;
        }
        const appConfig = this.createConfig(args);
        const serverConfig = this.createServerConfigWithDefaults(appConfig.serverConfig);
        const httpFsServer = new HttpFsServer(serverConfig);
        const httpServer = await httpFsServer.start();
        const pathExists = existsSync(httpFsServer.resolvedPath);
        const result: IStartResult = {
            address: httpServer.address() as AddressInfo,
            appConfig: appConfig,
            httpFsServer: httpFsServer,
            serverConfig: serverConfig,
            pathExists: pathExists,
            errors: []
        };
        return result;
    }

    private getArgumentsErrors(args: string[]): string[] {
        const errors: string[] = [];
        if (args.indexOf(ArgName.sslCertFile) >= 0 && args.indexOf(ArgName.sslKeyFile) === -1) {
            errors.push(`When ${ArgName.sslCertFile} argument is provided, ${ArgName.sslKeyFile} is required`);
        }
        if (args.indexOf(ArgName.sslKeyFile) >= 0 && args.indexOf(ArgName.sslCertFile) === -1) {
            errors.push(`When ${ArgName.sslKeyFile} argument is provided, ${ArgName.sslCertFile} is required`);
        }
        return errors;
    }

    private createConfig(args: string[]): IAppConfig {
        const config: IAppConfig = {
            serverConfig: {} as IServerConfig,
            logEvents: false
        };
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            if (arg === ArgName.path) {
                i++;
                config.serverConfig.path = this.resolveEnvironmentVariables(args[i]);
            } else if (arg === ArgName.defaultFileName) {
                i++;
                config.serverConfig.defaultFileName = args[i];
            } else if (arg === ArgName.useSsl) {
                config.serverConfig.useSsl = true;
            } else if (arg === ArgName.sslCertFile) {
                i++;
                config.serverConfig.sslCertFile = args[i];
            } else if (arg === ArgName.sslKeyFile) {
                i++;
                config.serverConfig.sslKeyFile = args[i];
            } else if (arg === ArgName.host) {
                i++;
                config.serverConfig.host = args[i];
            } else if (arg === ArgName.port) {
                i++;
                config.serverConfig.port = +args[i];
            } else if (arg === ArgName.mimeMap) {
                i++;
                config.serverConfig.mimeMap = JSON.parse(args[i]);
            } else if (arg === ArgName.mimeMapFile) {
                i++;
                const mimeMapFile = this.resolveEnvironmentVariables(args[i]);
                config.serverConfig.mimeMap = JSON.parse(readFileSync(mimeMapFile).toString());
            } else if (arg === ArgName.notFoundFile) {
                i++;
                config.serverConfig.notFoundFile = this.resolveEnvironmentVariables(args[i]);
            } else if (arg === ArgName.logEvents) {
                config.logEvents = true;
            } else if (arg === ArgName.directoryListing) {
                config.serverConfig.directoryListing = true;
            } else {
                throw new Error(`Unknown argument ${arg}`);
            }
            i++;
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
            notFoundFile: sourceConfig.notFoundFile,
            path: sourceConfig.path || this.defaults.serve.path,
            port: baseConfig.port || inferredDefaultPort,
            sslCertFile: sourceConfig.sslCertFile,
            sslKeyFile: sourceConfig.sslKeyFile,
            useSsl: sourceConfig.useSsl || false,
            directoryListing: sourceConfig.directoryListing || false
        };
        return config;
    }

    private resolveEnvironmentVariables(value: string): string {
        if (!value) {
            return value;
        }
        const replaced = value.replace(/%([^%]+)%/g, (foundSubstring: string, ...args: any[]) => {
            return process.env[args[0]] as string;
        });
        return replaced;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class Logger {
    private readonly colors = {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m'
    };
    private readonly out: NodeJS.WriteStream;

    constructor() {
        this.out = process.stdout;
    }

    error(text: string, err?: Error): void {
        let errMessage = '';
        let errStack = '';
        if (err) {
            errMessage = err.message;
            errStack = err.stack || '';
        }
        this.logWithColor(this.colors.red, `${text} ${errMessage} ${errStack}`)
    }

    logWithColor(color: string, text: string): void {
        const coloredText = `${color}${this.getDatePrependedMessage(text)}\n${this.colors.reset}`;
        this.out.write(coloredText);
    }

    warn(text: string): void {
        this.logWithColor(this.colors.yellow, text);
    }

    log(text: string): void {
        this.out.write(`${this.getDatePrependedMessage(text)}\n`);
    }

    private getDatePrependedMessage(text: string): string {
        return `${this.getDateAsString()} : ${text}`;
    }

    private getDateAsString(): string {
        return new Date().toISOString();
    }
}

const logger = new Logger();
const app = new App();
app.start().then(obj => {
    if (obj.errors.length > 0) {
        logger.error('Startup errors');
        obj.errors.forEach(x => logger.error(x));
        return;
    }
    if (obj.appConfig.logEvents) {
        attachToEvents(obj.httpFsServer.eventEmitter);
    }
    logger.log(`Listening on ${obj.address.address}:${obj.address.port}`);
    logger.log(`Serving path '${obj.serverConfig.path}' resolved to '${obj.httpFsServer.resolvedPath}'`);
    if (!obj.pathExists) {
        logger.warn(`WARNING: Path not found: '${obj.httpFsServer.resolvedPath}'`);
    }
    logger.log(`App config ${JSON.stringify(obj.appConfig)}`);
    logger.log(`Server config ${JSON.stringify(obj.serverConfig)}`);
}).catch(err => {
    logger.error('Start failed: ', err);
});

function attachToEvents(httpFsServerEventEmitter: EventEmitter): void {
    httpFsServerEventEmitter.on(EventName.requestArrived, data => {
        const eventData = data as IRequestArrivedEventArgs;
        logger.log(`${EventName.requestArrived} : ${eventData.request.method} ${eventData.request.url}` +
            ` (requestId ${eventData.requestId})`);
    });
    httpFsServerEventEmitter.on(EventName.fileResolved, data => {
        const eventData = data as IFileResolvedEventArgs;
        logger.log(`${EventName.fileResolved} : ${eventData.path} (${eventData.contentType})` +
            ` (requestId ${eventData.requestId})`);
    });
    httpFsServerEventEmitter.on(EventName.responseSent, data => {
        const eventData = data as IResponseSent;
        logger.log(`${EventName.responseSent} : finished for ${eventData.duration} ms : ${eventData.request.url}` +
            ` (requestId ${eventData.requestId})`);
    });
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
    pathExists: boolean;
    errors: string[];
}

const enum ArgName {
    path = '--path',
    defaultFileName = '--default-file-name',
    useSsl = '--use-ssl',
    sslCertFile = '--ssl-cert-file',
    sslKeyFile = '--ssl-key-file',
    host = '--host',
    port = '--port',
    mimeMap = '--mime-map',
    mimeMapFile = '--mime-map-file',
    notFoundFile = '--not-found-file',
    logEvents = '--log-events',
    directoryListing = '--directory-listing'
}
