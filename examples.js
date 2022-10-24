var Promise = require("./promise");

function rhomiseAll() {
    var all = Rhomise.all([
        new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                reject(123);
            }, 500);
        }),
        new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                resolve(123);
            }, 4000);
        }),
        new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                resolve(123);
            }, 4000);
        })
    ])

    all.then(function (result) {
        console.log(result);
    }).error(function (err) {
        console.log(err);

        var timer = setInterval(function () {
            console.log("Executing");
        }, 500);

        setTimeout(function () {
            clearInterval(timer);

            console.log(all);
        }, 10000);
    });
}

function rhomiseChain() {
    var generate = function () {
        return new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                console.log("inside generate");
                resolve("Something wrong");
            }, 1000);
        });
    }

    var rhomise2 = new Rhomise(function (resolve, reject) {
        setTimeout(function () {
            console.log("inside rhomise2")
            reject(generate);
        }, 2000);
    });

    rhomise2.then(function (result) {
        console.log("First", result);

        return 5;
    });

    rhomise2.error(function (err) {
        console.log(err.message);

        return -1;
    });

    (new Rhomise(function (resolve, reject) {
        setTimeout(function () {
            resolve(1);
        }, 1000);
    })).then(function (r) {
        console.log("Other First: ", r);

        rhomise2.then(function (result) {
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

function resolveWithRhomise() {
    function generateRhomise() {
        return new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                resolve(5)
            }, 500);
        });
    }

    var rhomise1 = new Rhomise(function (resolve, reject) {
        resolve(generateRhomise);
    });

    rhomise1.then(function (res) {
        console.log("First", res);

        return 23;
    }).then(function (res) {
        throw new Error(res);
    }).error(function (err) {
        return new Rhomise(function (resolve, reject) {
            setTimeout(function () {
                console.log("Before resolving err");
                resolve(err);
            }, 4000);
        });
    }).then(function (res) {
        console.log(res);

        throw new Error("Works")
    }).error(function (err) {
        console.log(err);
    });
}