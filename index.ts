import { HttpFsServer, IServerConfig } from './http-fs-server';

export class App {

    async start(): Promise<HttpFsServer> {
        const args = process.argv.slice(2);
        const appConfig = this.getConfig(args);
        const serverConfig = this.createServerConfigWithDefaults(appConfig.serverConfig);
        const httpFsServer = new HttpFsServer(serverConfig);
        await httpFsServer.start();
        return httpFsServer;
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
app.start().catch(err => {
    logError('Start failed: ', err);
});

function logError(text: string, err?: Error): void {
    let errMessage = '';
    let errStack = '';
    if (err) {
        errMessage = err.message;
        errStack = err.stack || '';
    }
    process.stderr.write(`${text}-${errMessage}-${errStack}\n`);
}

interface IAppConfig {
    serverConfig: IServerConfig;
}
