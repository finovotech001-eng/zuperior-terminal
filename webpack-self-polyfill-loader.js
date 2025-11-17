// Webpack loader to inject 'self' polyfill before SignalR code
module.exports = function(source) {
  // Inject polyfill at the very beginning of the module
  const polyfill = `
    if (typeof self === 'undefined') {
      var self = globalThis || global || {};
    }
  `;
  
  return polyfill + '\n' + source;
};

