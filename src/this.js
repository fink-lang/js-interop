exports.with_this = (fn)=> function with_this(...args) {
  return fn.call(undefined, this, ...args);
}
