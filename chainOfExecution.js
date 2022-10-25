/**
 * Refer to Chain Of Responsibility Pattern
 * Once decided, this pattern could fit our needs for TPromise
 * together with State pattern most likely
 */
function ChainOfExecution(callable) {
    this.next = null;
    this.callable = callable;

    /**
     * 
     * @param {ChainOfExecution} next 
     * @returns {ChainOfExecution} Given `next`
     */
    this.setNext = function (next) {
        if (!(next instanceof ChainOfExecution)) {
            throw new Error("Inaccurate next type");
        }

        return this.next = next;
    };

    /**
     * Initiates the execution
     * @param {Array.<any>} params
     */
    this.handle = function (params) {
        this.callable.apply(null, params);

        if (this.next !== null) {
            this.next.handle(params);
        }
    };
}

module.exports = ChainOfExecution;