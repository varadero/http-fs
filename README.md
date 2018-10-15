# Simple static HTTP file server
Serves files from a given path. Uses Node streams for low memory usage and no dependencies on third party modules.

# Install
`npm install`

# Build
The source code is written in `TypeScript` so it must be build before use:

`npm run build`

Application files can be found in `dist` folder

# Usage
`cd dist`

`node index.js`

This will serve files in current directory available at `http:/localhost`

Command line parameters:
- `--path` - Root path to be served. Can be either relative or absolute. Defaults to `.` (if not provided, current directory will be served). Can contain only Windows-style (%NAME%) environment variables.
- `--host` - Host or IP on which to listen. Defaults to `127.0.0.1`.
- `--port` - Port on which to listen. Defaults to 80 if `--use-ssl` is not provided and 443 if `--use-ssl` is provided.
- `--default-file-name` - The default file name to serve if the URL is a folder. Defaults to `index.html`. To switch off default file serving, set it to empty string inside quotes - `--default-file-name ""`
- `--use-ssl` - If provided, files will be served over HTTPS
- `--ssl-cert-file` - Points to a file containing the certificate. Required when `--use-ssl` is provided. Can contain environment variables.
- `--ssl-key-file` - Points to a file containing the certificate key. Required when `--use-ssl` is provided. Can contain environment variables.
- `--mime-map` - JSON (special characters like double quotes must be escaped - `\"`) representing MIME map of file extensions (without the dot in front of the extension) and HTTP Content-Type header value. The entries in the default MIME map with the same key as these provided in `--mime-map` will be overwritten. Defaults to empty JSON. Default MIME map contains the following entries:

```
css: 'text/css',
html: 'text/html',
ico: 'image/x-icon',
jpg: 'image/jpeg',
jpeg: 'image/jpeg',
js: 'application/javascript',
json: 'application/json',
otf: 'font/otf',
png: 'image/png',
ttf: 'font/ttf',
txt: 'text/plain',
woff: 'font/woff',
woff2: 'font/woff2'
```

Extension that does not exist in the resulting MIME map are served with `Content-Type: application/octet-stream`

## Samples
- Serve at `http://localhost` with default file `index.html`:

`node index.js`

- Serve absolutely specified directory

`node --path "c:/some/path/to/web files"`

- Serve relatively specified directory

`node --path ./dist`

`node --path ../../webapp`

- Serve with Windows-style envionment variable in the path

`node --path %WEBAPP_FOLDER%`

`node --path ../../webapps/%WEBAPP_NAME%/dist`

- Serve without default file so trying to access a folder will result in `HTTP 404 Not Found`:

`node index.js --default-file-name ""`

- Serve at specific IP and port

`node index.js --host 192.168.0.1 --port 12345`

- Serve with HTTPS (you can create `.pem` files using `openssl`)

`node index.js --use-ssl --ssl-cert-file "C:\some path\to\certificate files\cert.pem" --ssl-key-file "C:\some path\to\certificate files\key.pem"`

- Serve with MIME map overwrites (`js:text/plain` overwriting exiting `js:application/javascript` and added `htm:text/html`) 

`node index.js --mime-map "{\"js\":\"text/plain\",\"htm\":\"text/html\"}"`

Setting MIME map value to an empty string will serve its file extension as the default `Content-Type: application/octet-stream`
