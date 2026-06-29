import { createReceiver } from "./receiver.js";

function createDefaultReceiver(logger, config) {
  return new Promise((resolve) => {
    const receiver = createReceiver(config, () => {
      const address = receiver.address();
      logger.log(`Buffertron Receiver listening at ${address.address}:${address.port}`);
      resolve(receiver);
    });
    receiver.on('data', (messageCounter, timestamp, datasets, data, encodedData, encoding) => {
      if (datasets.length === 0) {
        return;
      }
      const rate = data.length > 0 ? (encodedData.length / data.length * 100).toFixed(1) + ' %' : 'n/a';
      logger.info(`RX ${encodedData.length} bytes with ${datasets.length} dataset${datasets.length === 1 ? '': 's'} (${rate} of ${data.length} bytes, ${encoding})`);
      // logger.info(JSON.stringify(JSON.parse(String(data)), null, 2));
      for (const dataset of datasets) {
        // logger.info(dataset);
      }
    });
  });
}

export { createDefaultReceiver };
