
exports.ˆnew = (cls, ...args)=> Reflect.construct(cls, args);

exports.apply = Reflect.apply;

exports.has = Reflect.has;
exports.get = Reflect.get;
exports.set = Reflect.set;
exports.set_props = Object.assign;

exports.delete_property = Reflect.deleteProperty;
exports.define_property = Reflect.defineProperty;

exports.own_keys = Reflect.ownKeys;

exports.get_own_property_descriptor = Reflect.getOwnPropertyDescriptor;

exports.get_prototype_of = Reflect.getPrototypeOf;
exports.set_prototype_of = Reflect.setPrototypeOf;

exports.is_extensible = Reflect.isExtensible;
exports.prevent_extensions = Reflect.preventExtensions;

exports.get_type = (obj)=> typeof obj;

exports.is_instance = (obj, cls)=> obj instanceof cls;
