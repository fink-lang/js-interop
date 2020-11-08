class Iterator {
  *[Symbol.iterator]() {
    let it = this;
    let value, next_it, accu;
    while (true) {
      [value, next_it, accu] = it.next(accu);
      if (next_it.done) {
        return;
      }
      yield value;
      it = next_it
    }
  }

  async *[Symbol.asyncIterator]() {
    let it = this;
    let value, next_it, accu;
    while (true) {
      [value, next_it, accu] = await it.next(accu);
      if (next_it.done) {
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

  next(shared_accu) {
    const {items, idx} = this;
    if(idx < items.length) {
      return [items[idx], new IndexedIterator(items, idx + 1), shared_accu];
    }
    return [undefined, emtpy_iter, shared_accu];
  }
}



class JSIterableIterator extends Iterator {
  constructor(iterable) {
    super();
    this.iter = iterable[Symbol.iterator]();
  }

  next(shared_accu) {
    const {iter} = this;
    // TODO use send with shared_accu?
    const {value, done} = iter.next();
    if (done) {
      return [undefined, emtpy_iter, shared_accu];
    }

    // TODO: remember next iterator's value and use it if next() called
    // again, thus creating a compatible repeatable iterator
    return [value, new JSIterableIterator(iter), shared_accu];
  }
}



class FuncIterator extends Iterator {
  constructor (next, state) {
    super();
    this.next_fn = next;
    this.state = state;
  }

  next(shared_accu) {
    return this.next_fn(this.state, shared_accu);
  }
}

const iterator = (next_fn, state)=> new FuncIterator(next_fn, state);



class EmptyIterator extends Iterator {
  constructor () {
    super();
    this.done = true;
  }

  next(shared_accu) {
    return [undefined, this, shared_accu];
  }

  [Symbol.iterator]() {
    return {next() { return {done: true}; }};
  }
}

const emtpy_iter = new EmptyIterator();


const is_done = (it)=> it === emtpy_iter || it.done === true;



export const _next_ = (it, accu)=> it.next(accu);



export const _is_empty_ = (iterable)=> {
  if (iterable === emtpy_iter || iterable === null || iterable === undefined) {
    return true;
  }

  if (typeof iterable === 'string' || iterable instanceof Array) {
    return iterable.length === 0;
  }

  if (iterable instanceof Set || iterable instanceof Map) {
    return iterable.size === 0;
  }

  const [, it] = _next_(_iter_(iterable));
  return is_done(it);
};



export const _len_ = (iterable)=> {
  if (iterable === emtpy_iter || iterable === null || iterable === undefined) {
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
    for (const item of iterable) {
      count += 1;
    }
    return count;
  }

  let count = 0;
  let it = _iter_(iterable);

  while (true) {
    [, it] = _next_(it);
    if (is_done(it)) {
      return count;
    }
    count += 1;
  }
};



export const _in_ = (item, obj)=> {
  if (obj === emtpy_iter || obj === null || obj === undefined) {
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
      if (is_done(it)) {
        return false;
      } else if (value === item) {
        return true;
      }
    }
  }

  if (typeof obj[Symbol.iterator] === 'function') {
    let count = 0;
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
    emtpy_iter;
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
  return emtpy_iter;
}


class SpreadableIterator extends Iterator {
  constructor(step_fn, num_args, spread_result, input, accu) {
    super();
    this.input = input;
    this.step_fn = step_fn;
    this.num_args = num_args;
    this.spread_result = spread_result;
    this.accu = accu;
  }
}


class MappingIterator extends SpreadableIterator {

  next(shared_accu) {
    const {input: iterable, num_args, spread_result, step_fn} = this;
    const use_accu = num_args > 1;
    let value, next_shared_accu;
    let {accu} = this;

    const [item, next_it, step_accu=shared_accu] = _next_(iterable, shared_accu);

    if (is_done(next_it)) {
      return [undefined, next_it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = step_fn(item, accu, step_accu);
    } else {
      value = step_fn(item);
      next_shared_accu=step_accu;
    }

    if (spread_result) {
      return _next_(
        chain(
          _iter_(value),
          new MappingIterator(step_fn, num_args, spread_result, next_it, accu),
        ),
        next_shared_accu
      );
    }
    return [
      value,
      new MappingIterator(step_fn, num_args, spread_result, next_it, accu),
      next_shared_accu
    ];
  }
}


class AsyncMappingIterator extends SpreadableIterator {
  async next(shared_accu) {
    const {input: iterable, num_args, spread_result, step_fn} = this;
    const use_accu = num_args > 1;
    let value, next_shared_accu;
    let {accu} = this;

    const [item, next_it, step_accu=shared_accu] = await _next_(iterable, shared_accu);

    if (is_done(next_it)) {
      return [undefined, next_it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = await step_fn(item, accu, step_accu);
    } else {
      value = await step_fn(item);
      next_shared_accu=step_accu;
    }

    if (spread_result) {
      return _next_(
        chain_async(
          _iter_(value),
          new AsyncMappingIterator(step_fn, num_args, spread_result, next_it, accu),
        ),
        next_shared_accu
      );
    }
    return [
      value,
      new AsyncMappingIterator(step_fn, num_args, spread_result, next_it, accu),
      next_shared_accu
    ];
  }
}

export const _map_ = (step_fn, num_args, async, spread_result)=> (iterable)=> (
  async
    ? new AsyncMappingIterator(step_fn, num_args, spread_result, _iter_(iterable), undefined)
    : new MappingIterator(step_fn, num_args, spread_result, _iter_(iterable), undefined)
);



class LoopIterator extends Iterator {
  constructor(step_fn, num_args, iterable, accu) {
    super();
    this.iterable = iterable;
    this.step_fn = step_fn;
    this.num_args = num_args;
    this.accu = accu;
  }
}


class FilteringIterator extends LoopIterator {
  next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, step_accu, item;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    while(true) {
      [item, it, step_accu=next_shared_accu] = _next_(it, next_shared_accu);
      if (is_done(it)) {
        return [undefined, it, step_accu];
      }

      let value;
      if (use_accu) {
        [value, accu, next_shared_accu=step_accu] = step_fn(item, accu, step_accu);
      } else {
        value = step_fn(item);
        next_shared_accu = step_accu
      }

      if (value === true) {
        return [
          item,
          new FilteringIterator(step_fn, num_args, it, accu),
          next_shared_accu
        ];
      }
    }
  }
}

class AsyncFilteringIterator extends LoopIterator {
  async next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, step_accu, item;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    while(true) {
      [item, it, step_accu=next_shared_accu] = await _next_(it, next_shared_accu);
      if (is_done(it)) {
        return [undefined, it, step_accu];
      }

      let value;
      if (use_accu) {
        [value, accu, next_shared_accu=step_accu] = await step_fn(item, accu, step_accu);
      } else {
        value = await step_fn(item);
        next_shared_accu = step_accu
      }

      if (value === true) {
        return [
          item,
          new AsyncFilteringIterator(step_fn, num_args, it, accu),
          next_shared_accu
        ];
      }
    }
  }
}

export const _filter_ = (step_fn, num_args, async)=> (iterable)=> (
  async
    ? new AsyncFilteringIterator(step_fn, num_args, _iter_(iterable), undefined)
    : new FilteringIterator(step_fn, num_args, _iter_(iterable), undefined)
);


// TODO: same as filter, except we exit on first non True
class WhileIterator extends LoopIterator {
  next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, step_accu, item;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    [item, it, step_accu=next_shared_accu] = _next_(it, next_shared_accu);

    if (is_done(it)) {
      return [undefined, it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = step_fn(item, accu, step_accu);
    } else {
      value = step_fn(item);
      next_shared_accu = step_accu;
    }

    if (value === true) {
      return [
        item,
        new WhileIterator(step_fn, num_args, it, accu),
        next_shared_accu
      ];
    }
    return [undefined, emtpy_iter, next_shared_accu];
  }
}

class AsyncWhileIterator extends LoopIterator {
  async next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, step_accu, item;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    [item, it, step_accu=next_shared_accu] = await _next_(it, next_shared_accu);

    if (is_done(it)) {
      return [undefined, it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = await step_fn(item, accu, step_accu);
    } else {
      value = await step_fn(item);
      next_shared_accu = step_accu;
    }

    if (value === true) {
      return [
        item,
        new AsyncWhileIterator(step_fn, num_args, it, accu),
        next_shared_accu
      ];
    }
    return [undefined, emtpy_iter, next_shared_accu];
  }
}


export const _while_ = (step_fn, num_args, async)=> (iterable)=> (
  async
    ? new AsyncWhileIterator(step_fn, num_args, _iter_(iterable), undefined)
    : new WhileIterator(step_fn, num_args, _iter_(iterable), undefined)
);



class UntilIterator extends LoopIterator {
  next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, item, step_accu;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    [item, it, step_accu=next_shared_accu] = _next_(it, next_shared_accu);

    if (is_done(it)) {
      return [undefined, it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = step_fn(item, accu, step_accu);
    } else {
      value = step_fn(item);
      next_shared_accu = step_accu
    }

    if (value === true) {
      return [
        item,
        iterator((_, shared_accu)=> [undefined, emtpy_iter, shared_accu]),
        next_shared_accu
      ];
    }

    return [
      item,
      new UntilIterator(step_fn, num_args, it, accu),
      next_shared_accu
    ];
  }
}

class AsyncUntilIterator extends LoopIterator {
  async next(shared_accu) {
    const {num_args, step_fn} = this;
    const use_accu = num_args > 1;

    let value, item, step_accu;
    let next_shared_accu = shared_accu;
    let {accu, iterable: it} = this;

    [item, it, step_accu=next_shared_accu] = await _next_(it, next_shared_accu);

    if (is_done(it)) {
      return [undefined, it, step_accu];
    }

    if (use_accu) {
      [value, accu, next_shared_accu=step_accu] = await step_fn(item, accu, step_accu);
    } else {
      value = await step_fn(item);
      next_shared_accu = step_accu
    }

    if (value === true) {
      return [
        item,
        iterator((_, shared_accu)=> [undefined, emtpy_iter, shared_accu]),
        next_shared_accu
      ];
    }

    return [
      item,
      new AsyncUntilIterator(step_fn, num_args, it, accu),
      next_shared_accu
    ];
  }
}

export const _until_ = (step_fn, num_args, async)=> (iterable)=> (
  async
    ? new AsyncUntilIterator(step_fn, num_args, _iter_(iterable), undefined)
    : new UntilIterator(step_fn, num_args, _iter_(iterable), undefined)
);



class UnfoldingIterator extends SpreadableIterator {
  next(shared_accu) {
    const {num_args, step_fn, spread_result, input: prev} = this;
    const use_accu = num_args > 1;

    let value;
    let next_shared_accu = shared_accu;
    let {accu} = this;

    if (use_accu) {
      [value, accu, next_shared_accu=shared_accu] = step_fn(prev, accu, shared_accu);
    } else {
      value = step_fn(prev);
      next_shared_accu = shared_accu;
    }

    if (spread_result) {
      return _next_(
        chain(
          _iter_(value),
          new UnfoldingIterator(step_fn, num_args, spread_result, value, accu),
        ),
        next_shared_accu
      );
    }
    return [
      value,
      new UnfoldingIterator(step_fn, num_args, spread_result, value, accu),
      next_shared_accu
    ];
  }
}

class AsyncUnfoldingIterator extends Iterator {
  constructor(step_fn, num_args, spread_result, prev, accu) {
    super();
    this.prev = prev;
    this.step_fn = step_fn;
    this.num_args = num_args;
    this.spread_result = spread_result;
    this.accu = accu;
  }

  async next(shared_accu) {
    const {num_args, step_fn, spread_result, prev} = this;
    const use_accu = num_args > 1;

    let value;
    let next_shared_accu = shared_accu;
    let {accu} = this;

    if (use_accu) {
      [value, accu, next_shared_accu=shared_accu] = await step_fn(prev, accu, shared_accu);
    } else {
      value = await step_fn(prev);
      next_shared_accu = shared_accu;
    }

    if (spread_result) {
      return await _next_(
        chain_async(
          _iter_(value),
          new UnfoldingIterator(step_fn, num_args, spread_result, value, accu),
        ),
        next_shared_accu
      );
    }
    return [
      value,
      new AsyncUnfoldingIterator(step_fn, num_args, spread_result, value, accu),
      next_shared_accu
    ];
  }
}


export const _unfold_ = (step_fn, num_args, async, spread_result)=> (prev)=> (
  async
    ? new AsyncUnfoldingIterator(step_fn, num_args, spread_result, prev, undefined)
    : new UnfoldingIterator(step_fn, num_args, spread_result, prev, undefined)
);



export const fold_sync = (reducer, num_args, result)=> (iterable)=> {
  const use_accu = num_args > 2;
  let it = _iter_(iterable);
  let accu, item, shared_accu, step_accu;

  while (true) {
    [item, it, step_accu=shared_accu] = _next_(it, step_accu);
    if (is_done(it)) {
      return result;
    }
    if (use_accu) {
      [result, accu, shared_accu=step_accu] = reducer(item, result, accu, step_accu);
    } else {
      result = reducer(item, result);
      shared_accu = step_accu;
    }
  }
};


export const fold_async = (reducer, num_args, result)=> async (iterable)=> {
  const use_accu = num_args > 2;
  let it = _iter_(iterable);
  let accu, item, shared_accu, step_accu;

  while (true) {
    [item, it, step_accu=shared_accu] = await _next_(it, step_accu);
    if (is_done(it)) {
      return result;
    }
    if (use_accu) {
      [result, accu, shared_accu=step_accu] = await reducer(item, result, accu, step_accu);
    } else {
      result = await reducer(item, result);
      shared_accu = step_accu;
    }
  }
};


export const _fold_ = (reducer, num_args, is_async, initial)=> (
  is_async
    ? fold_async(reducer, num_args, initial)
    : fold_sync(reducer, num_args, initial)
);



class ChainIterator extends Iterator {
  constructor(iters) {
    super();
    this.iters = iters;
  }

  next(shared_accu) {
    let {iters} = this;
    let it, item, next_shared_accu;

    while (true) {
      [it, ...iters] = iters;
      [item, it, next_shared_accu=shared_accu] = _next_(it, shared_accu);

      if (is_done(it)) {
        if (iters.length === 0) {
          return [undefined, it, next_shared_accu];
        }
        shared_accu = next_shared_accu;
      } else {
        return [item, new ChainIterator([it, ...iters]), next_shared_accu];
      }
    }
  }
}

class AsyncChainIterator extends Iterator {
  constructor(iters) {
    super();
    this.iters = iters;
  }

  async next(shared_accu) {
    let {iters} = this;
    let it, item, next_shared_accu;

    while (true) {
      [it, ...iters] = iters;
      [item, it, next_shared_accu=shared_accu] = await _next_(it, shared_accu);

      if (is_done(it)) {
        if (iters.length === 0) {
          return [undefined, it, next_shared_accu];
        }
        shared_accu = next_shared_accu;
      } else {
        return [item, new AsyncChainIterator([it, ...iters]), next_shared_accu];
      }
    }
  }
}
const chain = (...iterables)=> new ChainIterator(iterables);
const chain_async = (...iterables)=> new AsyncChainIterator(iterables);



class ZipIterator extends Iterator {
  constructor(iterables) {
    super();
    this.iterables = iterables;
  }

  next(shared_accu) {
    const {iterables} = this;
    const len = iterables.length;
    const iters = new Array(len);
    const values = new Array(len);
    let step_accu = shared_accu;

    for (let i = 0; i < len; i++) {
      const [val, next_it, next_acc=step_accu] = _next_(iterables[i], step_accu);
      if (is_done(next_it)) {
        return [[], emtpy_iter, next_acc];
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

