/* eslint-disable max-depth */
/* eslint-disable line-comment-position */
/* eslint-disable no-param-reassign */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-plusplus */

// based on https://github.com/mattbierner/hamt


import {get_hash as gen_hash} from './hash.js';

const SIZE = 5;
const BUCKET_SIZE = 2 ** SIZE;
const MASK = BUCKET_SIZE - 1;
const MAX_INDEX_NODE = BUCKET_SIZE / 2;
const MIN_ARRAY_NODE = BUCKET_SIZE / 4;

const LEAF = 1;
const COLLISION = 2;
const INDEX = 3;
const ARRAY = 4;


const is_del_op = (op)=> typeof op === 'undefined'


const pop_count = (x)=> {
  x -= ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  x += (x >> 8);
  x += (x >> 16);
  return (x & 0x7f);
};


const hash_fragment = (shift, h)=> (h >>> shift) & MASK;

const to_bitmap = (x)=> 1 << x;

const from_bitmap = (bitmap, bit)=> pop_count(bitmap & (bit - 1));


const array_set = (arr, at, value)=> {
  const {length} = arr;
  const out = new Array(length);
  // TODO out array may be too small as some at >= length, thus creating a sparse array
  for (let idx=0; idx < length; ++idx) {
    out[idx] = arr[idx];
  }

  out[at] = value;
  return out;
};


const array_del = (arr, at)=> {
  const {length} = arr;
  const out = new Array(length - 1);
  let i = 0;
  let g = 0;

  while (i < at) {
    out[g++] = arr[i++];
  }
  ++i;

  while (i < length) {
    out[g++] = arr[i++];
  }
  return out;
};


const array_insert = (arr, at, value)=> {
  const len = arr.length;
  const out = new Array(len + 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }

  out[g++] = value;

  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
};


const is_leaf = ({type})=>  (type === LEAF || type === COLLISION);


const leaf_node = (hash, key, value)=> ({
  type: LEAF,
  hash,
  key,
  value
});


const collision_node = (children, hash)=> ({
  type: COLLISION,
  children,
  hash
});


const indexed_node = (children, mask)=> ({
  type: INDEX,
  children,
  mask
});


const array_node = (children, size)=> ({
  type: ARRAY,
  children,
  size
});


const expand = (sub_nodes, frag, child, bitmap)=> {
  const arr = [];
  let bit = bitmap;
  let count = 0;

  for (let i=0; bit; ++i) {
    if ((bit & 1) !== 0) {
      arr[i] = sub_nodes[count++];
    }
    bit >>>= 1;
  }

  arr[frag] = child;
  return array_node(arr, count + 1);
};


const pack = (elems, count, removed)=> {
  const children = new Array(count - 1);
  let g = 0;
  let bitmap = 0;

  for (let idx=0, len=elems.length; idx < len; ++idx) {
    if (idx !== removed) {
      const elem = elems[idx];
      if (elem !== undefined) {
        children[g++] = elem;
        bitmap |= 1 << idx;
      }
    }
  }

  return indexed_node(children, bitmap);
};



const merge_leafs = (shift, hash1, node1, hash2, node2)=> {
  if (hash1 === hash2) {
    return collision_node([node2, node1], hash1);
  }

  const frag1 = hash_fragment(shift, hash1);
  const frag2 = hash_fragment(shift, hash2);

  return indexed_node(
    (frag1 === frag2
      ? [merge_leafs(shift + SIZE, hash1, node1, hash2, node2)]
      : frag1 < frag2
        ? [node1, node2]
        : [node2, node1]
    ),
    to_bitmap(frag1) | to_bitmap(frag2)
  );
};




const update_collision_list = (hash, list, op, key, size)=> {
  const {length} = list;

  for (let idx = 0; idx < length; ++idx) {
    const child = list[idx];

    if (child.key === key) {
      if (is_del_op(op)) {
        --size.value
        return array_del(list, idx);
      }

      const {value} = child;
      const new_value = op(value);

      if (new_value === value) {
        return list;
      }

      return array_set(list, idx, leaf_node(hash, key, new_value));
    }
  }

  if (is_del_op(op)) {
    return list;
  }

  const new_value = op();

  ++size.value;
  return array_set(list, length, leaf_node(hash, key, new_value));
};



const modify_leaf_node = (node, shift, op, hash, key, size)=> {
  if (key === node.key) {
    if (is_del_op(op)) {
      --size.value;
      return undefined;
    }

    const {value} = node;
    const new_value = op(value);

    return (
      new_value === value
        ? node
        : leaf_node(hash, key, new_value)
    );
  }

  if (is_del_op(op)) {
    return node;
  }

  const new_value = op();

  ++size.value;
  return merge_leafs(shift, node.hash, node, hash, leaf_node(hash, key, new_value));
};



const modify_collision_node = (node, shift, op, hash, key, size)=> {
  const {hash: node_hash} = node;

  if (hash === node_hash) {
    const {children} = node;
    const colls = update_collision_list(node_hash, children, op, key, size);

    if (colls === children) {
      return node;
    }

    return colls.length > 1
      ? collision_node(colls, node_hash)
      : colls[0]; // collapse single element collision list
  }

  if (is_del_op(op)) {
    return node;
  }

  const new_value = op();

  ++size.value;
  return merge_leafs(shift, node_hash, node, hash, leaf_node(hash, key, new_value));
};



const modify_indexed_node = (node, shift, op, hash, key, size)=> {
  const {mask, children} = node;
  const frag = hash_fragment(shift, hash);
  const bit = to_bitmap(frag);
  const idx = from_bitmap(mask, bit);
  const exists = mask & bit;

  if (exists === 0) { // add
    const new_child = empty_modify(op, hash, key, size);

    if (new_child === undefined) {
      return node;
    }

    return children.length >= MAX_INDEX_NODE
      ? expand(children, frag, new_child, mask)
      : indexed_node(array_insert(children, idx, new_child), mask | bit);
  }

  const current = children[idx];
  const new_child = modify_node(current, shift + SIZE, op, hash, key, size);

  if (current === new_child) {
    return node;
  }

  if (new_child === undefined) { // remove
    const bitmap = mask & ~bit;
    /* istanbul ignore next */
    if (bitmap === 0) {
      return undefined;
    }

    return (
      children.length === 2 && is_leaf(children[idx ^ 1])
        ? children[idx ^ 1] // collapse
        : indexed_node(array_del(children, idx), bitmap)
    );
  }

  // modify
  return (
    is_del_op(op) && children.length === 1 && is_leaf(new_child)
      ? new_child // propagate collapse
      : indexed_node(array_set(children, idx, new_child), mask)
  );
};



const modify_array_node = (node, shift, op, hash, key, size)=> {
  const {size: count, children} = node;
  const frag = hash_fragment(shift, hash);
  const child = children[frag];

  const new_child = child === undefined
    ? empty_modify(op, hash, key, size)
    : modify_node(child, shift + SIZE, op, hash, key, size);

  if (child === new_child) {
    return node;
  }

  if (child === undefined && new_child !== undefined) { // add
    return array_node(array_set(children, frag, new_child), count + 1);
  }

  if (child !== undefined && new_child === undefined) { // remove
    const count_less_1 = count - 1;
    return (
      count_less_1 <= MIN_ARRAY_NODE
        ? pack(children, count, frag)
        : array_node(array_set(children, frag, undefined), count_less_1)
    );
  }

  // modify
  return array_node(array_set(children, frag, new_child), count);
};



const empty_modify = (op, hash, key, size)=> {
  if (is_del_op(op)) {
    return undefined;
  }

  const value = op();

  ++size.value;
  return leaf_node(hash, key, value);
};



const modify_node = (node, shift, op, h, k, size)=> {
  const {type} = node;
  if (type === LEAF) {
    return modify_leaf_node(node, shift, op, h, k, size);

  } else if (type === ARRAY) {
    return modify_array_node(node, shift, op, h, k, size);

  } else if (type === INDEX) {
    return modify_indexed_node(node, shift, op, h, k, size);

  } // else if (type === COLLISION) {
  return modify_collision_node(node, shift, op, h, k, size);
}


const get_from_collision = (node, hash, key, fallback)=> {
  if (hash === node.hash) {
    const {children} = node;

    for (let i=0, len=children.length; i < len; ++i) {
      const {key: child_key, value} = children[i];
      if (key === child_key) {
        return value;
      }
    }
  }
  return fallback;
};



export const get = (map, key, alt)=> {
  const hash = gen_hash(key);
  let {root: node} = map;

  if (node === undefined) {
    return alt;
  }

  let shift = 0;

  while (true) {
    switch (node.type) {
    case LEAF:
      return key === node.key
        ? node.value
        : alt;

    case COLLISION:
      return get_from_collision(node, hash, key, alt)

    case INDEX: {
      const frag = hash_fragment(shift, hash);
      const bit = to_bitmap(frag);

      if ((node.mask & bit) !== 0) {
        node = node.children[from_bitmap(node.mask, bit)];
        shift += SIZE;
        break;
      }
      return alt;
    }

    default: // case ARRAY:
      node = node.children[hash_fragment(shift, hash)];
      if (node !== undefined) {
        shift += SIZE;
        break;
      }
      return alt;


    // default:
    //   // TODO: unreachable?
    //   return alt;
    }
  }
};



export const update = (map, key, op)=> {
  const hash = gen_hash(key)
  const size = {value: map.size};
  const {root} = map;

  const new_root = root === undefined
    ? empty_modify(op, hash, key, size)
    : modify_node(root, 0, op, hash, key, size);

  return new_root === root
    ? map
    : {root: new_root, size: size.value}
};


export const set = (map, key, value)=> (
  // original impl used a tagged obj to indicate a set or del operation
  // e.g. {_is_hamt_set: true, value}. It looks like using a func is
  // not significantly less performant than testing for the tagged object
  // and extracting the value from it or calling it as a func if it is an update
  // so we use a func all the time. This removes some code branches and keeps the
  // interface for update a bit more consistant.
  update(map, key, ()=> value)
);


export const del = (map, key)=> (
  update(map, key)
);


export const empty = {root: undefined, size: 0}


