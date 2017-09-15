/**
 * Recursive equality tester. Return true if the top down element of the path in the base is equal to the given value
 * @param base current base
 * @param path current path
 * @param value value to verify
 * @param equality override the equality assertion
 * @returns {boolean} true if the value is in the base at the end of the path
 */
function recursiveEqual(base, path, value, equality) {
  if (!base || typeof base !== 'object') {
    return false;
  }
  const [key, nextKey] = path;

  if (nextKey === undefined) {
    return equality ? equality(base[key], value) : base[key] === value;
  }

  return recursiveEqual(base[key], path.slice(1), value, equality);
}

/**
 * Compute next base in recursion
 * @param base current base
 * @param key current key in the path
 * @param nextKey next key in the path
 * @param withArrays create arrays instead of object when nextKey is a number and key has no value in the current base
 */
const nextBase = (base, key, nextKey, withArrays) => base[key] || (withArrays && typeof nextKey === 'number' ? [] : {});

/**
 * Reduce multiple elements in the accumulator using the setFunction when base is an Array
 * @param setFunction
 */
const reduceWithArray = setFunction =>
  /**
   * Reduce multiple elements in the accumulator
   * @param base current base
   * @param path current path
   * @param keys list of keys ; we know there that keys is an array or set
   * @param nextKey next key in the path
   * @param values list of values, has to be an array
   * @param withArrays
   * @param accumulator new instance of the array at the current level
   * @returns {*} the accumulator with the new elements
   */
  (base, path, keys, nextKey, values, withArrays, accumulator) => {
    if (!Array.isArray(values)) {
      throw new Error('Can not use object values with array in path');
    }

    return keys.reduce((acc, key, index) => {
      const newValue = setFunction(nextBase(base, key, nextKey, withArrays), path.slice(1), values[index], withArrays);

      if (key < acc.length) {
        acc[key] = newValue;
      } else {
        acc.push(newValue);
      }

      return acc;
    }, accumulator);
  };

/**
 * Reduce multiple elements in an new Object using the setFunction when base is an Object
 * @param setFunction
 */
const reduceWithObject = fn =>
  /**
   * Reduce multiple elements in an new Object
   * @param base current base
   * @param path current path
   * @param keys list of keys ; we know there that keys is an array or set
   * @param nextKey next key in the path
   * @param values list of values, could be an array or an object
   * @param withArrays
   * @returns {*} a set of the new elements
   */
  (base, path, keys, nextKey, values, withArrays) => {
    if (Array.isArray(values)) {
      return keys.reduce((acc, key, index) => {
        acc[key] = fn(nextBase(base, key, nextKey, withArrays), path.slice(1), values[index], withArrays);

        return acc;
      }, {});
    }

    return keys.reduce((acc, key) => {
      acc[key] = fn(nextBase(base, key, nextKey, withArrays), path.slice(1), values[key], withArrays);

      return acc;
    }, {});
  };

/**
 * Recursive immutable set
 * @param base current base
 * @param path current path
 * @param value current value
 * @param withArrays create arrays instead of object when nextKey is a number and key has no value in the current base
 * @returns {*} a new instance of the given level
 */
function set(base, path, value, withArrays) {
  if (path.length === 0) {
    return value;
  }

  const [key, nextKey] = path;
  const isArrayKeys = Array.isArray(key);
  let currentBase = base;

  if (!base || typeof base !== 'object') {
    currentBase = (isArrayKeys && typeof key[0] === 'number') || (withArrays && typeof key === 'number') ? [] : {};
  }

  if (isArrayKeys) {
    if (Array.isArray(currentBase)) {
      return reduceWithArray(set)(currentBase, path, key, nextKey, value, withArrays, [...currentBase]);
    }

    return {
      ...currentBase,
      ...reduceWithObject(set)(currentBase, path, key, nextKey, value, withArrays, {}),
    };
  }

  if (Array.isArray(currentBase)) {
    return [
      ...currentBase.slice(0, key),
      set(nextBase(currentBase, key, nextKey, withArrays), path.slice(1), value, withArrays),
      ...currentBase.slice(key + 1),
    ];
  }

  return {
    ...currentBase,
    [key]: set(nextBase(currentBase, key, nextKey, withArrays), path.slice(1), value, withArrays),
  };
}

/**
 * Main function, recursive immutable set
 * @param base base object
 * @param initialPath path to the place where the value is going to be set
 * @param value value to set
 * @param options options
 * @returns {*} new instance of the base if it has been modified, the base otherwise
 */
export default function safeSet(base, initialPath, value, options = {}) {
  const { withArrays = false, equality, safe } = options;
  let path = initialPath;

  // Handle string path
  if (typeof path === 'string' && path.length > 0) {
    path = path.split('.');
    path = path.reduce((acc, key) => {
      const groupe = /\[([0-9]*)\]/.exec(key);

      if (groupe) {
        acc.push(key.substr(0, groupe.index), Number(groupe[1]));
      } else {
        acc.push(key);
      }

      return acc;
    }, []);
  }

  if (!Array.isArray(path) || path.length < 1) {
    return base === value ? base : value;
  }

  // If the value is already here we just need to return the base
  if (safe && recursiveEqual(base, path, value, equality)) {
    return base;
  }

  return set(base, path, value, withArrays);
}
