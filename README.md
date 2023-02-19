# Simple static HTTP file server
Serves files from a given path. Uses Node streams for low memory usage and no dependencies on third party modules.

# Clone
`git clone https://github.com/varadero/http-fs.git`

`cd http-fs`

# Install
`npm install`

# Build
The source code is written in `TypeScript` so it must be build before use:

`npm run build`

Application files can be found in `dist` folder

# Usage
After the application is build, execute this from any folder:

`node path/to/http-fs/dist/index.js --path path/to/folder/to/serve`

This will serve files in specified directory in the `--path` parameter.

Command line parameters:
- `--path` - Root path to be served. Can be either relative or absolute. Defaults to `.` (if not provided, current directory will be served). Can contain only Windows-style (`%NAME%`) environment variables.
- `--host` - Host or IP at which to listen. Defaults to `127.0.0.1`.
- `--port` - Port at which to listen. Defaults to 80 if `--use-ssl` is not provided and 443 if `--use-ssl` is provided.
- `--directory-listing` - Will show directory content.
- `--default-file-name` - The default file name to serve if the URL is a folder. Defaults to `index.html`. To switch off default file serving, set it to empty string inside quotes - `--default-file-name ""`. Will be ignored if `--directory-listing` is provided
- `--not-found-file` - The file which must be served in case the requested file cannot be found. Can contain environment variables.
- `--use-ssl` - If provided, files will be served over HTTPS. If optional `--ssl-cert-file` and `ssl-key-file` are not provided, internal self-signed certificate will be used.
- `--ssl-cert-file` - Points to a file containing the certificate. Can contain environment variables. If provided, `ssl-key-file` must also be provided.
- `--ssl-key-file` - Points to a file containing the certificate key. Can contain environment variables. If provided, `ssl-cert-file` must also be provided.
- `--mime-map-file` - Points to a JSON file containing MIME map. Can contain only Windows-style (%NAME%) environment variables.
- `--mime-map` - JSON (special characters like double quotes must be escaped - `\"`) representing MIME map of file extensions (without the dot in front of the extension) and HTTP Content-Type header value. The entries in the default MIME map with the same key as these provided in `--mime-map` will be overwritten. Defaults to empty JSON. Default MIME map contains the following entries:
```json
{
    "css": "text/css",
    "gif": "image/gif",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "application/javascript",
    "json": "application/json",
    "otf": "font/otf",
    "png": "image/png",
    "svg": "image/svg+xml",
    "ttf": "font/ttf",
    "txt": "text/plain",
    "woff": "font/woff",
    "woff2": "font/woff2",
    ".": "application/octet-stream",
    "*": "application/octet-stream"
}
```
- `--log-events` - Logs some of the request and response events
- `--response-header` - Adds specified response header to success responses (this excludes HTTP 404's for example). The value after this parameter should be enclosed in quotes and must contain the header name and its value in format `header-name:value` - the name of the header followed by `:` followed by the value. Multiple `--response-header` can be added in case multiple response headers are needed

### MIME map specifics
- Files without extensions are referenced with `.` map
- File extensions not specified are referenced with `*` map
- All file extensions that map to empty content type will not be served (`404 Not Found` will be returned). The logic for finding content type is the following: If the file extension exists in the mapping - use its content type, if it doesn't exists - use content type specified in `*` map
- If all not specified file extesions must be disabled, set `*` map to empty string. This will constrain http-fs to serve only file extensions specified in the MIME map (which does not map to empty strings)

## Samples

- Serve path `./dist` at `http://localhost` with default file `index.html` with sample log output:

`node path/to/http-fs/dist/index.js --path ./dist --log-events`

- Serve absolutely specified directory

`node path/to/http-fs/dist/index.js --path "c:/some/path/to/web files"`

- Serve relatively specified directory

`node path/to/http-fs/dist/index.js --path ./dist`

`node path/to/http-fs/dist/index.js --path ../../webapp`

- Serve with Windows-style envionment variable in the path

`node path/to/http-fs/dist/index.js --path %WEBAPP_FOLDER%`

`node path/to/http-fs/dist/index.js --path ../../webapps/%WEBAPP_NAME%/dist`

- Serve without default file so trying to access a folder will result in `HTTP 404 Not Found`:

`node path/to/http-fs/dist/index.js --default-file-name ""`

- Serve with directory content listing

`node path/to/http-fs/dist/index.js --directory-listing`

- Serve specified file if requested is not found. Can be used for SPA applications so when the browser is refreshed while at some route URL, the application will be loaded from specified HTML file keeping the URL in the browser

`node path/to/http-fs/dist/index.js --not-found-file ./index.html`

- Serve at specific IP and port

`node path/to/http-fs/dist/index.js --host 192.168.0.1 --port 12345`

- Serve with HTTPS using internal self-signed certificate

`node path/to/http-fs/dist/index.js --use-ssl`

- Serve with HTTPS specifying certificate `.pem` files (you can create `.pem` files using `openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem`)

`node path/to/http-fs/dist/index.js --use-ssl --ssl-cert-file "C:\path\to\certificate files\cert.pem" --ssl-key-file "C:\path\to\certificate files\key.pem"`

- Serve with MIME map overwrites provided as JSON file

`node path/to/http-fs/dist/index.js --mime-map-file path/to/mime-map.json`

- Serve with MIME map overwrites provided as argument (`js:text/plain` overwriting exiting `js:application/javascript` and added `htm:text/html`) 

`node path/to/http-fs/dist/index.js --mime-map "{\"js\":\"text/plain\",\"htm\":\"text/html\"}"`

- Serve with MIME map disabling `ttf` files (`"ttf":""`)

`node path/to/http-fs/dist/index.js --mime-map "{\"ttf\":\"\"}"`

- Serve with MIME map disabling all non-specified files (`"*":""`)

`node path/to/http-fs/dist/index.js --mime-map "{\"*\":\"\"}"`

- Serve with 2 custom headers added (`permissions-policy` and `X-Some-Name`)

`node path/to/http-fs/dist/index.js --path ./dist --response-header "permissions-policy:geolocation=(),microphone=(),camera=(),magnetometer=(),gyroscope=(),fullscreen=(self),payment=()" --response-header "X-Some-Name:some value"`