import EventEmitter from 'node:events';
import http from 'node:http';
import zlib from 'node:zlib';

const DEFAULT_MAX_CONTENT_LENGTH = 2 * 1024 * 1024;

function fail(req, res, code, headers) {
  res.statusCode = code;
  for (const [key, value] of Object.entries(headers ?? {})) {
    res.setHeader(key, value);
  }
  res.end();
  req?.destroy();
}

const decoders = {
  identity(data, options, callback) { callback(null, data); },
  brotli: zlib.brotliDecompress,
  deflate: zlib.inflate,
  gzip: zlib.gunzip,
}

const supportedContentEncodings = Object.keys(decoders).join(', ');

class Receiver extends EventEmitter {
  /**
   * @type {http.Server}
   */
  #server = null;

  /**
   * @returns {import('node:net').AddressInfo}
   */
  address() { return this.#server.address(); }

  constructor(config, callback) {
    super();

    if (typeof callback === 'function') {
      this.once('listening', callback);
    }

    const maxContentLength = +(config.maxBodySize ?? DEFAULT_MAX_CONTENT_LENGTH);

    this.#server = http.createServer((req, res) => {
      const chunks = [];
      let contentLength = 0;

      req.on('data', (chunk) => {
        contentLength += chunk.length;
        if (contentLength > maxContentLength) {
          return void fail(req, res, 413, { 'max-content-length': maxContentLength });
        }
        chunks.push(chunk);
      });

      req.on('end', async () => {
        if (req.destroyed) { return; }

        const encoding = req.headers['content-encoding']?.toLowerCase() ?? 'identity';
        const decode = decoders[encoding];
        if (typeof decode !== 'function') {
          return void fail(null, res, 415, { 'supported-content-encoding': supportedContentEncodings });
        }
        const encodedData = Buffer.concat(chunks);

        decode(encodedData, {}, async (error, data) => {
          if (error) {
            this.emit('decoding-error', error, encodedData, encoding);
            return void fail(null, res, 400, { 'supported-content-encoding': supportedContentEncodings });
          }
          let parsedData;
          try {
            parsedData = JSON.parse(data);
          } catch (error) {
            this.emit('json-parse-error', error, data);
            return void fail(null, res, 400, { 'expected-content-type': 'application/json' });
          }
          const { messageCounter, txTimestamp, datasets } = parsedData;
          try {
            this.emit('data', messageCounter, txTimestamp, datasets, data, encodedData, encoding);
          } catch (error) {
            console.error(error);
            return void fail(null, res, 422, {});
          }
          res.statusCode = 204;
          res.end();
        });
      });
    });

    this.#server.listen(config.listen, () => {
      this.emit('listening');
    });
  }
}

function createReceiver(config, callback) {
  return new Receiver(config, callback);
}

export { createReceiver };
