
/**
 * Represents the cycle state of TPromise object
 * 
 * @type {Object}
 */
var CHAIN_STATE = {
    IDLE: 0,
    ENGAGED: 1,
};

/**
 * Returns an object whose responsibility is to register and run
 * `ChainItem` objects on the next event loop
 * 
 * Execution will be triggered once .engage call is made
 */
function CallbackChain() {
    this.first = null;
    this.next = null;
    this.state = CHAIN_STATE.IDLE;
    this.payload = null
}

/**
 * Returns the result of chain execution
 * @returns {any|null} Null on no registered callbacks
 */
CallbackChain.prototype.getResult = function () {
    if (this.payload === null) {
        return null;
    }

    return this.payload['result'];
}

/**
 * Sets the CallbackChain's payload
 * 
 * @param {any} result 
 * @param {Boolean} isError 
 * @returns {CallbackChain}
 */
CallbackChain.prototype.setPayload = function (result, isError) {
    this.payload = { result, isError };

    return this;
}

/**
 * Schedules execution to next event loop if it has not already been scheduled
 * 
 * @param {Boolean} shouldRun A boolean indicate
 */
CallbackChain.prototype.engage = function () {
    if (this.isEngaged() || this.first === null) {
        return;
    }

    if (this.payload === null) {
        throw new Error("CallbackChain can not run without a proper payload");
    }

    this.state = CHAIN_STATE.ENGAGED;
    setImmediate(this.run.bind(this));
}

/**
 * Registers a ChainItem that will be executed once chain is engaged
 * 
 * @param {ChainItem} chainItem 
 * @returns {CallbackChain}
 */
CallbackChain.prototype.register = function (chainItem) {
    if (this.first === null) {
        this.first = chainItem;
        this.next = this.first;
    } else {
        this.next = this.next.setNext(chainItem);
    }

    return this;
}

/**
 * Returns a boolean indicating whether chain is engaged
 * 
 * @returns {Boolean}
 */
CallbackChain.prototype.isEngaged = function () {
    return this.state === CHAIN_STATE.ENGAGED;
}

/**
 * Starts execution and after completion, prepares internal state for next
 */
CallbackChain.prototype.run = function () {
    this.first.handle(this.payload);

    this.next = null;
    this.first = null;
    this.state = CHAIN_STATE.IDLE;
}

module.exports = CallbackChain;