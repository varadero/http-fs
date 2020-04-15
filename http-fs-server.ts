import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';

export class HttpFsServer {

    eventEmitter = new EventEmitter();
    resolvedPath = '';

    private httpServer: https.Server | http.Server | null = null;
    private basePath = '';
    private mimeMap: { [key: string]: string } = {};
    private totalRequests = 0;

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
        this.basePath = cfg.path;
        this.resolvedPath = path.resolve(cfg.path);
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
        this.totalRequests++;
        const requestId = this.totalRequests;
        this.emitRequestArrived(request, response, requestId);

        if (!this.isHttpMethodSupported(request.method)) {
            return this.respondMethodNotAllowed(response);
        }
        if (!this.isUrlSafe(request.url)) {
            return this.respondNotFound(requestId, request, response);
        }
        this.serveFile(request.url, requestId, request, response);
    }

    private getDesiredFile(requestUrl?: string): string {
        requestUrl = requestUrl || '';
        const urlPathName = url.parse(requestUrl).pathname || '';
        const decodedUrl = decodeURI(urlPathName);
        const desiredFile = path.join(this.basePath, decodedUrl);
        return desiredFile;
    }

    private serveFile(
        requestUrl: string | undefined, requestId: number, request: http.IncomingMessage, response: http.ServerResponse
    ): void {
        let fileReadStream: fs.ReadStream;
        const startTime = Date.now();
        request.on('error', () => {
            this.closeReadStream(fileReadStream);
        });

        request.on('close', () => {
            this.closeReadStream(fileReadStream);
        });

        response.on('error', () => {
            this.closeReadStream(fileReadStream);
        });

        response.on('finish', () => {
            const endTime = Date.now();
            this.emitResponseSent(request, response, endTime - startTime, requestId);
        });
        let desiredFile = this.getDesiredFile(requestUrl);
        fs.stat(desiredFile, (err, stats) => {
            if (err) {
                this.closeReadStream(fileReadStream);
                return this.respondNotFound(requestId, request, response);
            }
            if (stats.isDirectory() && !this.config.defaultFileName) {
                return this.respondNotFound(requestId, request, response);
            }

            if (stats.isDirectory()) {
                desiredFile = path.join(desiredFile, this.config.defaultFileName);
            }

            const mimeType = this.getMimeType(path.extname(desiredFile));
            if (!mimeType) {
                // This file extension is not allowed
                this.respondNotFound(requestId, request, response);
                return;
            }
            this.emitFileResolved(desiredFile, mimeType, requestId);
            fileReadStream = this.createFileReadStream(desiredFile);
            response.setHeader('Content-Type', mimeType);
            fileReadStream.on('error', (fileReadErr: Error) => {
                this.closeReadStream(fileReadStream);
                if ((<any>fileReadErr).code === 'ENOENT') {
                    // File was not found. This could happen if fs.stats was executed on an existing file/directory
                    // but it was later changed to a non existing file before fs.createReadStream is called
                    // It happens if URL is a directory and the default file name was added to it which could not exists
                    this.respondNotFound(requestId, request, response);
                } else {
                    this.respondInternalServerError(response);
                }
            });
            fileReadStream.pipe(response);
        });
    }

    private createFileReadStream(filePath: string): fs.ReadStream {
        const stream = fs.createReadStream(filePath);
        return stream;
    }

    private closeReadStream(stream?: fs.ReadStream): void {
        if (stream) {
            stream.close();
        }
    }

    private getMimeType(fileExtension: string): string {
        fileExtension = fileExtension || '';
        let ext = fileExtension.toLowerCase().substring(1);
        if (ext === '') {
            // Files without extensions will map to . map
            ext = '.';
        }
        const contentType = this.mimeMap.hasOwnProperty(ext) ? this.mimeMap[ext] : this.mimeMap['*'];
        return contentType;
    }

    private isHttpMethodSupported(httpMethod?: string): boolean {
        return (httpMethod === 'GET');
    }

    private isUrlSafe(urlValue?: string): boolean {
        // Consider URL is safe if empty or if not containing any double dots (..)
        return !urlValue || (urlValue.indexOf('..') === -1);
    }

    private respondNotFound(requestId: number, request: http.IncomingMessage, response: http.ServerResponse): void {
        if (this.config.notFoundFile) {
            const fileExists = fs.existsSync(this.config.notFoundFile);
            if (fileExists) {
                this.serveFile(this.config.notFoundFile, requestId, request, response);
                return;
            }
        }

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

    private createMimeMap(overwrites?: { [key: string]: string }): { [key: string]: string } {
        const map: { [key: string]: string } = {
            'css': 'text/css',
            'gif': 'image/gif',
            'html': 'text/html',
            'ico': 'image/x-icon',
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg',
            'js': 'application/javascript',
            'json': 'application/json',
            'otf': 'font/otf',
            'png': 'image/png',
            'ttf': 'font/ttf',
            'txt': 'text/plain',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            // tslint:disable-next-line:object-literal-sort-keys
            '.': 'application/octet-stream',
            '*': 'application/octet-stream'
        };

        if (overwrites) {
            Object.assign(map, overwrites);
        }
        return map;
    }

    private emitRequestArrived(request: http.IncomingMessage, response: http.ServerResponse, requestId: number): void {
        const args: IRequestArrivedEventArgs = {
            request: request,
            requestId: requestId,
            response: response
        };
        this.eventEmitter.emit(EventName.requestArrived, args);
    }
    private emitFileResolved(filePath: string, contentType: string, requestId: number): void {
        const args: IFileResolvedEventArgs = {
            contentType: contentType,
            path: filePath,
            requestId: requestId
        };
        this.eventEmitter.emit(EventName.fileResolved, args);
    }

    private emitResponseSent(
        request: http.IncomingMessage,
        response: http.ServerResponse,
        duration: number,
        requestId: number
    ): void {
        const args: IResponseSent = {
            duration: duration,
            request: request,
            requestId: requestId,
            response: response
        };
        this.eventEmitter.emit(EventName.reponseSent, args);
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
    mimeMap?: { [key: string]: string };
    notFoundFile: string;
}

export const enum EventName {
    requestArrived = 'request-arrived',
    fileResolved = 'file-resolved',
    reponseSent = 'reponse-sent'
}

export interface IRequestArrivedEventArgs {
    requestId: number;
    request: http.IncomingMessage;
    response: http.ServerResponse;
}

export interface IFileResolvedEventArgs {
    requestId: number;
    path: string;
    contentType: string;
}

export interface IResponseSent {
    requestId: number;
    request: http.IncomingMessage;
    response: http.ServerResponse;
    duration: number;
}
