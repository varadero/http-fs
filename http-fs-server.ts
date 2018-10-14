import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';

export class HttpFsServer {
    private httpServer: https.Server | http.Server | null = null;
    private basePath = '';
    private mimeMap: { [key: string]: string } = {};
    private defaultMimeType = 'application/octet-stream';

    /**
     * Creates new instance using provided configuration
     */
    constructor(private config: IServerConfig) {
        this.mimeMap = this.createMimeMap(config.mimeMap);
    }

    /**
     * Starts a HTTP or HTTPS server (depending on the provided configuration in the constructor) an returns it
     */
    async start(): Promise<https.Server | http.Server> {
        const cfg = this.config;
        this.basePath = path.resolve(cfg.path);
        if (cfg.useSsl) {
            // In case we need HTTPS, we must create server options by loading certificate files
            const httpsServerOptions = <https.ServerOptions>{
                cert: fs.readFileSync(path.resolve(cfg.sslCertFile)),
                key: fs.readFileSync(path.resolve(cfg.sslKeyFile))
            };

            return new Promise<https.Server>(resolve => {
                this.httpServer = https.createServer(httpsServerOptions, (req, res) => this.requestCallback(req, res))
                    .listen(cfg.port, cfg.host, () => {
                        resolve(<https.Server>this.httpServer);
                    });
            });
        } else {
            return new Promise<http.Server>(resolve => {
                this.httpServer = http.createServer((req, res) => this.requestCallback(req, res))
                    .listen(cfg.port, cfg.host, () => {
                        resolve(<http.Server>this.httpServer);
                    });
            });
        }
    }

    /**
     * Stops the server
     */
    stop(): void {
        if (this.httpServer) {
            this.httpServer.close();
        }
    }

    private requestCallback(request: http.IncomingMessage, response: http.ServerResponse): void {
        if (!this.isHttpMethodSupported(request.method)) {
            return this.respondMethodNotAllowed(response);
        }
        if (!this.isUrlSafe(request.url)) {
            return this.respondNotFound(response);
        }

        let fileReadStream: fs.ReadStream | undefined;

        request.on('error', () => {
            this.closeReadStream(fileReadStream);
        });

        response.on('error', () => {
            this.closeReadStream(fileReadStream);
        });

        const urlPath = url.parse(request.url || '').path || '';
        let desiredFile = path.join(this.basePath, urlPath);
        fs.stat(desiredFile, (err, stats) => {
            if (err) {
                this.closeReadStream(fileReadStream);
                return this.respondNotFound(response);
            }
            if (stats.isDirectory() && !this.config.defaultFileName) {
                return this.respondNotFound(response);
            }

            if (stats.isDirectory()) {
                desiredFile = path.join(desiredFile, this.config.defaultFileName);
            }
            fileReadStream = fs.createReadStream(desiredFile);
            response.setHeader('Content-Type', this.getMimeType(path.extname(desiredFile)));
            fileReadStream.on('error', (fileReadErr: Error) => {
                this.closeReadStream(fileReadStream);
                if ((<any>fileReadErr).code === 'ENOENT') {
                    // File was not found. This could happen if fs.stats was executed on an existing file/directory
                    // but it was later changed to a non existing file before fs.createReadStream is called
                    // It happens if URL is a directory and the default file name was added to it which could not exists
                    this.respondNotFound(response);
                } else {
                    this.respondInternalServerError(response);
                }
            });
            fileReadStream.on('end', () => {
                this.closeReadStream(fileReadStream);
            });
            fileReadStream.pipe(response);
        });
    }

    private closeReadStream(stream?: fs.ReadStream): void {
        if (stream) {
            stream.close();
        }
    }

    private getMimeType(fileExtension: string): string {
        if (!fileExtension) {
            return this.defaultMimeType;
        }
        const lowercasedNoDot = fileExtension.toLowerCase().substring(1);
        const mimeType = this.mimeMap[lowercasedNoDot] || this.defaultMimeType;
        return mimeType;
    }

    private isHttpMethodSupported(httpMethod?: string): boolean {
        return (httpMethod === 'GET');
    }

    private isUrlSafe(urlValue?: string): boolean {
        // Consider URL is safe if empty or if not containing any double dots (..)
        return !urlValue || (urlValue.indexOf('..') === -1);
    }

    private respondNotFound(response: http.ServerResponse): void {
        response.statusCode = 404;
        response.end('Not Found');
    }

    private respondMethodNotAllowed(response: http.ServerResponse): void {
        response.statusCode = 405;
        response.end('Method Not Allowed');
    }

    private respondInternalServerError(response: http.ServerResponse): void {
        response.statusCode = 500;
        response.end('Internal Server Error');
    }

    private createMimeMap(overwrites: { [key: string]: string }): { [key: string]: string } {
        const map: { [key: string]: string } = {
            css: 'text/css',
            html: 'text/html',
            ico: 'image/x-icon',
            jpeg: 'image/jpeg',
            js: 'application/javascript',
            json: 'application/json',
            otf: 'font/otf',
            png: 'image/png',
            ttf: 'font/ttf',
            txt: 'text/plain',
            woff: 'font/woff',
            woff2: 'font/woff2'
        };
        map.jpg = map.jpeg;

        if (overwrites) {
            Object.assign(map, overwrites);
        }
        return map;
    }
}

export interface IServerConfig {
    path: string;
    defaultFileName: string;
    port: number;
    host: string;
    useSsl: boolean;
    sslCertFile: string;
    sslKeyFile: string;
    mimeMap: { [key: string]: string };
}
