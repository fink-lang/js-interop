class Iterator {
  *[Symbol.iterator]() {
    let it = this;
    let value, next_it, accu;
    while (true) {
      [value, next_it, accu] = it.next(accu);
      if (_is_done_(next_it)) {
        return;
      }
      yield value;
      it = next_it
    }
  }
}


class IndexedIterator extends Iterator {
  constructor(items, idx) {
    super();
    this.items = items;
    this.idx = idx;
  }

  next(accu2) {
    const {items, idx} = this;
    if(idx < items.length) {
      return [items[idx], new IndexedIterator(items, idx + 1), accu2];
    }
    return [undefined, _empty_iter_, accu2];
  }
}



class JSIterableIterator extends Iterator {
  constructor(iterable) {
    super();
    this.iter = iterable[Symbol.iterator]();
  }

  next(accu2) {
    const {iter} = this;
    // TODO use send with accu2?
    const {value, done} = iter.next();
    if (done) {
      return [undefined, _empty_iter_, accu2];
    }

    // TODO: remember next iterator's value and use it if next() called
    // again, thus creating a compatible repeatable iterator
    return [value, new JSIterableIterator(iter), accu2];
  }
}



class FuncIterator extends Iterator {
  constructor (next, state) {
    super();
    this.next_fn = next;
    this.state = state;
  }

  next(accu2) {
    return this.next_fn(this.state, accu2);
  }
}

export const _iterable_ = (next_fn, state)=> new FuncIterator(next_fn, state);



class EmptyIterator extends Iterator {
  constructor () {
    super();
    this.done = true;
  }

  next(accu2) {
    return [undefined, this, accu2];
  }

  *[Symbol.iterator]() {
    // empty
  }
}


export const _empty_iter_ = new EmptyIterator();


export const _is_done_ = (it)=> it === _empty_iter_ || it.done === true;


export const _next_ = (it, accu)=> it.next(accu);



export const _is_empty_ = (iterable)=> {
  if (iterable === _empty_iter_ || iterable === null || iterable === undefined) {
    return true;
  }

  if (typeof iterable === 'string' || iterable instanceof Array) {
    return iterable.length === 0;
  }

  if (iterable instanceof Set || iterable instanceof Map) {
    return iterable.size === 0;
  }

  const [, it] = _next_(_iter_(iterable));
  return _is_done_(it);
};



export const _len_ = (iterable)=> {
  if (iterable === _empty_iter_ || iterable === null || iterable === undefined) {
    return 0;
  }

  if (typeof iterable === 'string' || iterable instanceof Array) {
    return iterable.length;
  }

  if (iterable instanceof Set || iterable instanceof Map) {
    return iterable.size;
  }

  if (typeof iterable[Symbol.iterator] === 'function' && !(iterable instanceof Iterator)) {
    let count = 0;
    // eslint-disable-next-line no-unused-vars
    for (const item of iterable) {
      count += 1;
    }
    return count;
  }

  let count = 0;
  let it = _iter_(iterable);

  while (true) {
    [, it] = _next_(it);
    if (_is_done_(it)) {
      return count;
    }
    count += 1;
  }
};



export const _in_ = (item, obj)=> {
  if (obj === _empty_iter_ || obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj === 'string' || obj instanceof Array) {
    return obj.includes(item);
  }

  if (obj instanceof Set || obj instanceof Map) {
    return obj.has(item);
  }

  if (obj instanceof Iterator) {
    let it = _iter_(obj);
    let value;
    while (true) {
      [value, it] = _next_(it);
      if (_is_done_(it)) {
        return false;
      } else if (value === item) {
        return true;
      }
    }
  }

  if (typeof obj[Symbol.iterator] === 'function') {
    for (const value of obj) {
      if (value === item) {
        return true;
      }
    }
    return false;
  }

  // TODO: use Reflect.has?
  return Reflect.getOwnPropertyDescriptor(obj, item) !== undefined;
};



export const _iter_ = (iterable)=> {
  if (iterable === null || iterable === undefined) {
    _empty_iter_;
  } else if (iterable instanceof Iterator) {
    return iterable;
  } else if (iterable instanceof Array || typeof iterable === 'string') {
    return new IndexedIterator(iterable, 0);
  } else if (typeof iterable[Symbol.iterator] === 'function') {
    return  new JSIterableIterator(iterable);
  } else if (typeof iterable === 'object') {
    return new IndexedIterator(Object.entries(iterable), 0);
  }
  // TODO: make numbers iterable?
  return _empty_iter_;
}




class ZipIterator extends Iterator {
  constructor(iterables) {
    super();
    this.iterables = iterables;
  }

  next(accu2) {
    const {iterables} = this;
    const len = iterables.length;
    const iters = new Array(len);
    const values = new Array(len);
    let step_accu = accu2;

    for (let i = 0; i < len; i++) {
      const [val, next_it, next_acc=step_accu] = _next_(iterables[i], step_accu);
      if (_is_done_(next_it)) {
        return [[], _empty_iter_, next_acc];
      }
      values[i] = val;
      iters[i] = next_it;
      step_accu = next_acc;
    }
    return [values, new ZipIterator(iters), step_accu];
  }
}


export const _zip_ = (...iterables)=> (
  new ZipIterator(iterables.map(_iter_))
);



export const _reverse_ = (iterable)=> {
  // TODO: inspect type to optimize for Arrays, Strings, etc
  return [...iterable].reverse();
};


export const _sort_ = (compare)=> (iterable)=> {
  // TODO: inspect type to optimize for Arrays
  return [...iterable].sort(compare);
};



export const _join_ = (sep)=> (iterable)=> {
  // TODO: inspect type to optimize for Arrays, Strings, etc
  return [...iterable].join(sep);
};

