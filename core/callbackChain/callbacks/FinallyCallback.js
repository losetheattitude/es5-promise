var chain = require("../ChainItem");

var CALLBACK = chain.CALLBACK;
var ChainItem = chain.ChainItem;


FinallyCallback.prototype = Object.create(ChainItem.prototype);
FinallyCallback.prototype.constructor = FinallyCallback;
/**
 * Returns an object that contains a callback which will be executed
 * regardless of previous callback state
 * 
 * @param {Function} callback To be executed
 */
function FinallyCallback(callback) {
    ChainItem.apply(this, [CALLBACK.FINALLY, callback]);
}

/**
 * Returns a boolean indicating that this object can and will run
 * 
 * @param {Boolean} isError 
 * @returns {Boolean}
 */
FinallyCallback.prototype.canHandle = function (isError) {
    return !isError;
};

module.exports = FinallyCallback;