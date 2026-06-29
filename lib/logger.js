function wrap(name, fn) {
  return function(...args) {
    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} [${name}]`;
    if (typeof args[0] === 'string') {
      args[0] = `${prefix} ${args[0]}`;
    } else {
      args.unshift(prefix);
    }
    fn(...args);
  }
}

const nop = () => {}
const getNop = () => nop;

const LOGLEVELS = ['error', 'warn', 'info', 'debug' ];

function createLogger(name, level = 'info') {
  if ((level = LOGLEVELS.indexOf(level)) === -1) { level = LOGLEVELS.length - 1 };
  const logger = {
    error: level >= 0 ? wrap(name, console.error) : getNop(),
    warn: level >= 1 ? wrap(name, console.warn) : getNop(),
    info: level >= 2 ? wrap(name, console.info) : getNop(),
    debug: level >= 3 ? wrap(name, console.debug) : getNop(),
    log: wrap(name, console.log),
  };
  return logger;
}

export {
  createLogger,
};
