import { createGateway } from './gateway.js';

const lastErrors = {};

async function createDefaultGateway(logger, config) {
  const gateway = await createGateway(config);

  const address = gateway.address();
  logger.log(`Buffertron Gateway listening at ${address.address}:${address.port}/udp`);

  gateway.on('json-parse-error', (error, dataset, msg, rinfo) => {
    let prefixes = [], logfn = logger.error;
    try {
      const str = msg.toString();
      // remove unescaped trailing CRs and LFs from strings in beautified JSON
      if (/^\{\s*?\n.*\n\}(\r?\n)?$/ms.test(str)) {
        Object.assign(dataset, {
          type: 'json',
          data: JSON.parse(msg.toString().replace(/[\r\n]+(",?\r?\n)/g, '$1')),
        });
        prefixes.push('fixed');
        logfn = logger.warn;
      }
    } catch (_) {
      // unlucky
    }
    logfn(
      ...prefixes,
      // escape invalid JSON to avoid line breaks and other control carachters in log files
      // e.g. JSON.parse('foo\n"bar"\n') results in
      // SyntaxError: Unexpected token 'o', "foo\n\"bar\"\n" is not valid JSON
      JSON.stringify(error.toString()).slice(1, -1).replace(/\\"(.*)\\"/,'"$1"'),
      JSON.stringify({ length: msg.length, bytes: [...msg.values()] }),
      JSON.stringify(msg.toString()),
      `from ${rinfo.address}:${rinfo.port}`,
    );
  });
  gateway.on('dataset', (dataset, rinfo) => {
    logger.info('RX', JSON.stringify(dataset), `from ${rinfo.address}:${rinfo.port}`);
  });
  gateway.on('sender-started', (url, interval, encoding) => {
    logger.info(`send to ${url.href} every ${interval} ms ${encoding === 'identity' ? '' : `with encoding '${encoding}'`}`)
  });
  gateway.on('request-error', (error, url) => {
    const errorStr = String(error);
    if (lastErrors[url.href] === errorStr) {
      return;
    }
    lastErrors[url.href] = errorStr;
    logger.error(errorStr);
  });
  gateway.on('datasets-sent', (url, datasets, data, encoding, encodedData) => {
    const rate = (encodedData.length / data.length * 100).toFixed(1) + ' %';
    if (lastErrors[url.href] === null) {
      return;
    }
    logger.info(`TX ${encodedData.length} bytes with ${datasets.length} dataset${datasets.length === 1 ? '' : 's'} (${rate} of ${data.length} bytes, ${encoding}) to ${url.href}`);
  });
  gateway.on('request-ended', (url) => {
    lastErrors[url.href] = null;
  });

  return gateway;
}

export { createDefaultGateway };
