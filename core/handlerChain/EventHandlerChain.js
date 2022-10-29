/**
 * Refer to CallbackChain Of Responsibility Pattern
 * Once decided, this pattern could fit our needs for Rhomise
 * together with State pattern most likely
 */
function EventHandlerChain(callable) {
    this.next = null;
    this.callable = callable;
}

/**
 * Initiates the execution
 * @param {Array.<any>} params
 */
EventHandlerChain.prototype.handle = function (params) {
    //Keep the callable's context by calling it with .apply
    this.callable.apply(null, params);

    if (this.next !== null) {
        this.next.handle(params);
    }
};

/**
 * Sets and returns given `next` EventHandler
 * 
 * @param {EventHandlerChain} next 
 * @returns {EventHandlerChain}
 */
EventHandlerChain.prototype.setNext = function (next) {
    if (!(next instanceof EventHandlerChain)) {
        throw new Error("Inaccurate next type");
    }

    return this.next = next;
};

module.exports = EventHandlerChain;