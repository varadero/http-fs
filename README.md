# Simple static HTTP file server
Serves files from a given path. Uses Node streams for low memory usage and no dependencies on third party modules.

# Clone
`git clone https://github.com/varadero/http-fs.git`

Then navigate to its folder:

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
- `--path` - Root path to be served. Can be either relative or absolute. Defaults to `.` (if not provided, current directory will be served). Can contain only Windows-style (%NAME%) environment variables.
- `--host` - Host or IP on which to listen. Defaults to `127.0.0.1`.
- `--port` - Port on which to listen. Defaults to 80 if `--use-ssl` is not provided and 443 if `--use-ssl` is provided.
- `--default-file-name` - The default file name to serve if the URL is a folder. Defaults to `index.html`. To switch off default file serving, set it to empty string inside quotes - `--default-file-name ""`
- `--use-ssl` - If provided, files will be served over HTTPS
- `--ssl-cert-file` - Points to a file containing the certificate. Required when `--use-ssl` is provided. Can contain environment variables.
- `--ssl-key-file` - Points to a file containing the certificate key. Required when `--use-ssl` is provided. Can contain environment variables.
- `--mime-map-file` - Points to a JSON file containing MIME map. Can contain only Windows-style (%NAME%) environment variables.
- `--mime-map` - JSON (special characters like double quotes must be escaped - `\"`) representing MIME map of file extensions (without the dot in front of the extension) and HTTP Content-Type header value. The entries in the default MIME map with the same key as these provided in `--mime-map` will be overwritten. Defaults to empty JSON. Default MIME map contains the following entries:

```json
{
    "css": "text/css",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "application/javascript",
    "json": "application/json",
    "otf": "font/otf",
    "png": "image/png",
    "ttf": "font/ttf",
    "txt": "text/plain",
    "woff": "font/woff",
    "woff2": "font/woff2",
    ".": "application/octet-stream",
    "*": "application/octet-stream"
}
```
### MIME map specifics
- Files without extensions are referenced with `.` map
- File extensions not specified are referenced with `*` map
- All file extensions that map to empty content type will not be served (`404 Not Found` will be returned). The logic for finding content type is the following: If the file extension exists in the mapping - use its content type, if it doesn't exists - use content type specified in `*` map
- If all not specified file extesions must be disabled, set `*` map to empty string. This will constrain http-fs to serve only file extensions specified in the MIME map (which does not map to empty strings)

## Samples

- Serve at `http://localhost` with default file `index.html`:

`node path/to/http-fs/dist/index.js`

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

- Serve at specific IP and port

`node path/to/http-fs/dist/index.js --host 192.168.0.1 --port 12345`

- Serve with HTTPS (you can create `.pem` files using `openssl`)

`node path/to/http-fs/dist/index.js --use-ssl --ssl-cert-file "C:\some path\to\certificate files\cert.pem" --ssl-key-file "C:\some path\to\certificate files\key.pem"`

- Serve with MIME map overwrites provided as JSON file

`node path/to/http-fs/dist/index.js --mime-map-file path/to/mime-map.json`

- Serve with MIME map overwrites provided as argument (`js:text/plain` overwriting exiting `js:application/javascript` and added `htm:text/html`) 

`node path/to/http-fs/dist/index.js --mime-map "{\"js\":\"text/plain\",\"htm\":\"text/html\"}"`

-Serve with MIME map disabling `ttf` files (`"ttf":""`)

`node path/to/http-fs/dist/index.js --mime-map "{\"ttf\":\"\"}"`

-Serve with MIME map disabling all non-specified files (`"*":""`)

`node path/to/http-fs/dist/index.js --mime-map "{\"*\":\"\"}"`
