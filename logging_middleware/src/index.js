const { LoggerClient, ALLOWED_LEVELS, ALLOWED_PACKAGES, ALLOWED_STACKS } = require("./loggerClient");

function createLogger(options) {
  const client = new LoggerClient(options);

  return {
    Log: (stack, level, pkg, message) => client.log(stack, level, pkg, message),
    rawClient: client
  };
}

module.exports = {
  createLogger,
  LoggerClient,
  ALLOWED_STACKS,
  ALLOWED_LEVELS,
  ALLOWED_PACKAGES
};

