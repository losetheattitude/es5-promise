var chain = require("../ChainItem");

var CALLBACK = chain.CALLBACK;
var ChainItem = chain.ChainItem;


ThenCallback.prototype = Object.create(ChainItem.prototype);
ThenCallback.prototype.constructor = ThenCallback;
/**
 * Returns an object that contains a callback which will be executed
 * when no error was present on previous callback
 *  
 * @param {Function} callback To be executed
 */
function ThenCallback(callback) {
    ChainItem.apply(this, [callback, CALLBACK.THEN]);
}

/**
 * Returns a boolean indicating that this object can and will run
 * 
 * @param {Boolean} isError 
 * @returns {Boolean}
 */
ThenCallback.prototype.canHandle = function (isError) {
    return !isError;
};

module.exports = ThenCallback;