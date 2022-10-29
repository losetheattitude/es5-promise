var TPromise = require("./TPromise").TPromise;

function tpromiseAll() {
    var all = TPromise.all([
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                reject(1234);
            }, 500);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(1235);
            }, 2000);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(1236);
            }, 2000);
        })
    ]);

    all.then(function (result) {
        console.log("ALL THEN", result);
    }).catch(function (err) {
        console.log("ALL ERROR", err);

        var timer = setInterval(function () {
            console.log("Executing");
        }, 500);

        setTimeout(function () {
            clearInterval(timer);
        }, 10000);
    });
}

function tpromiseChain() {
    var generate = function () {
        return new TPromise(function (resolve, reject) {
            setTimeout(function () {
                console.log("inside generate");
                resolve("Something wrong");
            }, 1000);
        });
    }

    var tpromise2 = new TPromise(function (resolve, reject) {
        setTimeout(function () {
            console.log("inside tpromise2")
            reject(generate);
        }, 2000);
    });

    tpromise2.then(function (result) {
        console.log("First", result);

        return 5;
    });

    tpromise2.catch(function (err) {
        console.log(err);

        return -1;
    });

    (new TPromise(function (resolve, reject) {
        setTimeout(function () {
            resolve(1);
        }, 1000);
    })).then(function (r) {
        console.log("Other First: ", r);

        tpromise2.then(function (result) {
            console.log("Second", result);

            throw new Error("Exception 1");
        }).catch(function (err) {
            console.log("Third", err.message);

            return 5;
        }).then(function (res) {
            console.log("Fourth", res);

            return 4;
        }).then(function (res) {
            console.log("Fifth", res);

            return 12;
        }).then(function (res2) {
            console.log("Sixth", res2);

            throw new Error("Exception 2");
        }).catch(function (err) {
            console.log(err.message);
        });
    });
}

function resolveWithTPromise() {
    function generateTPromise() {
        return new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(5)
            }, 500);
        });
    }

    var tpromise1 = new TPromise(function (resolve, reject) {
        resolve(generateTPromise);
    });

    tpromise1.then(function (res) {
        var promise = res();
        promise.then(function (res2) {
            console.log(res2, "Other")
        })

        return 23;
    }).then(function (res) {
        throw new Error(res);
    }).catch(function (err) {
        return new TPromise(function (resolve, reject) {
            setTimeout(function () {
                console.log("Before resolving err");
                resolve(err);
            }, 4000);
        });
    }).then(function (res) {
        res.then(function (res3) {
            console.log(res3);
        });

        throw new Error("Works")
    }).catch(function (err) {
        console.log(err);
    });
}

+function fork() {
    var tpromise1 = new Rhomise(function (resolve, reject) {
        setTimeout(function () {
            resolve(432);
        }, 300)
    });
    var tpromise2 = tpromise1.then(function (res) {
        return 32;
    });

    var tpromise3 = tpromise1.then(function (res) {
        return 65;
    }).fork();

    tpromise1.then(function (res) {
        return res * 432;
    });

    setTimeout(function () {
        //Accessing the results this way is not recommended since you
        //probably would not receive the value that you were expecting to receive
        console.log("A:", tpromise1.getResult());
        console.log("B:", tpromise2.getResult());
        console.log("C:", tpromise3.getResult());
        console.log("A === C", tpromise1 === tpromise3);
        console.log("B === A", tpromise2 === tpromise1);
    }, 1000);

    var b = TPromise.any([
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(123);
            }, 500);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve("Other");
            }, 4000);
        }),
        new TPromise(function (resolve, reject) {
            resolve(12321312);
        })
    ]);

    b.then(function (t) {
        console.log(t);
    }).catch(function (t) {
        console.log("ERRRR", t);
    });

