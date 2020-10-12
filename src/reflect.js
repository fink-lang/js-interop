export const ˆnew = (cls, ...args)=> Reflect.construct(cls, args);


export const apply = /*#__PURE__*/ (()=> Reflect.apply)();
export const has = /*#__PURE__*/ (()=> Reflect.has)();
export const get = /*#__PURE__*/ (()=> Reflect.get)();
export const set = /*#__PURE__*/ (()=> Reflect.set)();
export const own_keys = /*#__PURE__*/ (()=> Reflect.ownKeys)();
export const delete_property = /*#__PURE__*/ (()=> Reflect.deleteProperty)();
export const define_property = /*#__PURE__*/ (()=> Reflect.defineProperty)();
export const get_own_property_descriptor = /*#__PURE__*/ (()=> Reflect.getOwnPropertyDescriptor)();
export const get_prototype_of = /*#__PURE__*/ (()=> Reflect.getPrototypeOf)();
export const set_prototype_of = /*#__PURE__*/ (()=> Reflect.setPrototypeOf)();
export const is_extensible = /*#__PURE__*/ (()=> Reflect.isExtensible)();
export const prevent_extensions = /*#__PURE__*/ (()=> Reflect.preventExtensions)();

export const set_props = /*#__PURE__*/ (()=> Object.assign)();

export const get_type = /*#__PURE__*/ (obj)=> typeof obj;

export const is_instance = (obj, cls)=> obj instanceof cls;
