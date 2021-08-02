

// TODO: return [err, result] or [result, err]?
export const try_catch = (cb)=> {
  try {
    return [false, cb()];
  } catch (err) {
    return [err, undefined];
  }
};


export const throw_err = (error)=> {
  throw error;
};


export const error = (...args)=> (
  new Error(...args)
);

