/**
 * Provides functionality while working with group of Rhomises
 * 
 * @param {Array.<Rhomise>} items 
 * @param {Callback} onFirst Callback to be called after first Rhomise resolves
 * @param {Callback} onComplete Callback to be called after all Rhomises resolve
 */
function PromiseArray(items, onFirst, onComplete) {
    this.items = items;
    this.completed = [];

    this.onFirst = onFirst;
    this.onComplete = onComplete;

    this.attach = attach;
    this.resolved = resolved;
}

/**
 * Performs callback attachments to Rhomises so we can be notified about the overall state
 */
function attach() {
    this.items.forEach(function (item, index) {
        var rhomise = new Rhomise(function (resolve) {
            item.then(function (result) {
                resolve([index, result]);
            });
        });

        var callback = (function (result) {
            this.resolved(result[0], result[1]);
        });

        rhomise.then(callback.bind(this));
    }, this);
}

/**
 * Responsible of calling appropriate event callbacks
 * 
 * @param {number} index 
 * @param {any} result 
 */
function resolved(index, result) {
    if (this.completed.length === 0) {
        if (this.onFirst) {
            this.onFirst(result, index);
        }
    }

    this.completed.splice(index, 0, result);
    if (this.completed.length === this.items.length) {
        if (this.onComplete) {
            this.onComplete(this.completed);
        }
    }
}

module.exports = PromiseArray;