import { createGateway } from './lib/gateway.js';
import { createReceiver } from './lib/receiver.js';
import { createLogger } from './lib/logger.js';
import { isMain } from './lib/is-main.js';

export {
  createGateway,
  createReceiver,
  createLogger,
}

if (isMain(import.meta.url)) {
  const runType = process.argv[2];
  const configUrl = new URL('file:' + process.argv[3], import.meta.url);
  const { default: config } = await import(configUrl, { with: { type: 'json' } });

  switch (runType) {
    case 'gateway': {
      const { createDefaultGateway } = await import('./lib/defaultGateway.js');
      createDefaultGateway(createLogger(`${process.pid}/G`, 'warn'), config.gateway);
      break;
    };
    case 'receiver': {
      const { createDefaultReceiver } = await import('./lib/defaultReceiver.js');
      createDefaultReceiver(createLogger(`${process.pid}/R`), config.receiver);
      break;
    };
    case 'both': {
      const { createDefaultGateway } = await import('./lib/defaultGateway.js');
      const { createDefaultReceiver } = await import('./lib/defaultReceiver.js');
      const receiver = await createDefaultReceiver(createLogger(`${process.pid}/R`), config.receiver);
      const gateway = await createDefaultGateway(createLogger(`${process.pid}/G`, 'warn'), config.gateway);
      break;
    };
    default: {
      logger.error('unknown run type: ' + runType);
    }
  }
}
