var TPromise = require("./promise");

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
    }).error(function (err) {
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

    tpromise2.error(function (err) {
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
        }).error(function (err) {
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
        }).error(function (err) {
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
    }).error(function (err) {
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
    }).error(function (err) {
        console.log(err);
    });
}

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
}).error(function (t) {
    console.log("ERRRR", t);
});