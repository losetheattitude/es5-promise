var chain = require("../ChainItem");

var CALLBACK = chain.CALLBACK;
var ChainItem = chain.ChainItem;


CatchCallback.prototype = Object.create(ChainItem.prototype);
CatchCallback.prototype.constructor = CatchCallback;
/**
 * Creates and fills the required fields
 * 
 * @param {Function} callback 
 */
function CatchCallback(callback) {
    ChainItem.apply(this, [CALLBACK.ERROR, callback]);
}

/**
 * Returns a boolean indicating that this function can and will run
 * 
 * @param {Boolean} isError 
 * @returns {Boolean}
 */
CatchCallback.prototype.canHandle = function (isError) {
    return isError;
};

module.exports = CatchCallback;