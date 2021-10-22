export const get_hash = (key)=> {
  let hash = 0;
  for (let idx=0, len = key.length; idx < len; ++idx) {
    hash = (((hash << 5) - hash) + key.charCodeAt(idx)) | 0;
  }
  return hash;
};
