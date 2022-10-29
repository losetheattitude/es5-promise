var CALLBACK = {
    THEN: 0,
    ERROR: 1,
    FINALLY: 2
};

/**
 * Base class for callback chains
 * 
 * @param {Number} type Type of callbacks: then, error, finally
 * @param {Function} callback Function to run
 */
function ChainItem(type, callback) {
    this.type = type;
    this.callback = callback;
    this.next = null
}

/**
 * Executes the invoked object's callback and delegates the execution to next
 * 
 * @param {any} result Variable to pass to callback
 * @param {boolean} isError A boolean indicating whether result is an error
 * @throws {Error} On error inside callback and no further appropriate chain item available
 * @returns {Object} this
 */
ChainItem.prototype.handle = function (payload) {
    if (this.canHandle(payload.isError)) {
        return this.execute(payload);
    } else {
        return this.tryNext(payload);
    }
};

/**
 * Moves to the next item of chain or might throw an Error on non existence
 * 
 * @param {any} result 
 * @param {Boolean} isError 
 * @throws {Error} On no appropriate handlers present
 * @returns {ChainItem}
 */
ChainItem.prototype.tryNext = function (payload) {
    if (this.next !== null) {
        return this.next.handle(payload)
    }

    if (payload.isError) {
        throw new Error("Uncaught error, " + payload.result);
    }

    return this;
}

/**
 * Invokes the callback and can move to the next
 * 
 * @param {any} result 
 * @returns this or next object's this
 */
ChainItem.prototype.execute = function (payload) {
    try {
        payload.result = this.callback(payload.result);
        payload.isError = false;
    } catch (err) {
        payload.isError = true;
        payload.result = err;
    }

    return this.tryNext(payload);
}

/**
 * This method needs to be overridden by concrete implementations
 */
ChainItem.prototype.canHandle = function (isError) {
    throw new Error("Not implemented!");
}

/**
 * Sets the next ChainOfCallback
 * @param {ChainItem} next 
 */
ChainItem.prototype.setNext = function (next) {
    if (!(next instanceof ChainItem)) {
        throw new Error("Invalid type");
    }

    return this.next = next;
}

module.exports = {
    ChainItem,
    CALLBACK
};