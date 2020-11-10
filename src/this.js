// eslint-disable-next-line no-shadow
export const with_this = (fn)=> function with_this(...args) {
  // eslint-disable-next-line no-invalid-this
  return fn(this, ...args);
}
