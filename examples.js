var Promise = require("./promise");

var promise = new Promise(function (resolve, reject) {
    setTimeout(function () {
        resolve(123);
    }, 1500);
});

promise.then(function (result) {
    console.log("Result from first then:", result);

    throw new Error("Something wrong!");
});

promise.then(function (result) {
    console.log("Should skip logging this one");
});

promise.error(function (err) {
    console.log("Catched: ", err.message);

    return 1;
});

promise.then(function (result) {
    console.log("Should print 1 === ", result);

    throw new Error("This should stop execution");
});

promise.then(function (result) {
    console.log("Should skip");
})

