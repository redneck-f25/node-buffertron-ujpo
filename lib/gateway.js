import EventEmitter from 'node:events';
import dgram from 'node:dgram';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';

const nop = () => {};

const encoders = {
  identity(data, options, callback) { callback(null, data); },
  brotli: zlib.brotliCompress,
  deflate: zlib.deflate,
  gzip: zlib.gzip,
};

class Gateway extends EventEmitter {
  /**
   * @type {dgram.Socket}
   */
  #socket = null;
  #buffers = [];

  /**
   * @returns {import('node:net').AddressInfo}
   */
  address() { return this.#socket.address(); }

  constructor(config, callback) {
    super();

    if (typeof callback === 'function') {
      this.once('listening', callback);
    }

    this.#socket = dgram.createSocket('udp4');

    this.#socket.on('error', (error) => {
      this.emit('recv-error', error);
      this.#socket.close();
    });

    this.#socket.on('message', (msg, rinfo) => {
      const timestamp = Date.now() / 1000;
      const dataset = { rxTimestamps: [timestamp] };
      try {
        Object.assign(dataset, { type: 'json', data: JSON.parse(msg) });
      } catch (error) {
        Object.assign(dataset, { type: 'bytes', data: [...msg.values()] });
        this.emit('json-parse-error', error, dataset, msg, rinfo);
      }

      this.emit('dataset', dataset, rinfo);

      this.#enqueueDataset(dataset);
    });

    this.#socket.bind(config.bind, () => {
      this.emit('listening');
      this.#initSenders(config);
    });
  }

  #initSenders(config) {
    config.senders.forEach((sender) => {
      if (!(sender.url)) { return; }
      const buffer = [];
      this.#buffers.push(buffer);
      const url = new URL(sender.url);
      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      };
      Object.assign(options.headers, sender.headers);
      const request = (url.protocol === 'https:' ? https : http).request;
      try {
        if (isNaN(options.timeout = +sender.connectTimeout)) {
          delete options.timeout;
        };
      } catch(_) {
        // no connectTimeout
      }
      const idleTimeout = +(sender.requestTimeout ?? 0);
      const encoding = sender.encoding ?? 'identity';
      const encode = encoders[encoding];
      if (encoding !== 'identity') {
        options.headers['content-encoding'] = encoding;
      }
      let messageCounter = 0;
      setInterval(() => {
        const req = request(url, options, (res) => {
          res.on('data', nop);
          res.on('end', () => {
            this.emit('request-ended', url);
          });
        });
        req.on('error', (error) => {
          this.emit('request-error', error, url)
        });
        if (idleTimeout) {
          req.setTimeout(idleTimeout, () => {
            req.destroy();
            this.emit('request-timeout', url);
          });
        }

        const datasets = buffer.splice(0);
        const data = JSON.stringify({
          messageCounter: ++messageCounter,
          txTimestamp: Date.now() / 1000,
          datasets,
        }, null, 0);

        encode(data, {}, (error, encodedData) => {
          if (error) {
            req.destroy();
            this.emit('encoding-error', error, data, encoding);
            return;
          }
          if (req.closed) { return; }
          req.write(encodedData);
          req.end();
          this.emit('datasets-sent', url, datasets, data, encoding, encodedData);
        });
      }, +sender.interval);
      this.emit('sender-started', url, sender.interval, encoding);
    });
  }

  #enqueueDataset(dataset) {
    for (const buffer of this.#buffers) { buffer.push(dataset); }
  }
}

function createGateway(config, callback) {
  return new Gateway(config, callback);
}

export { createGateway };
