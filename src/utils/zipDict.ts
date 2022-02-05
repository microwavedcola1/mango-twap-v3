export function zipDict<K extends string | number | symbol, V>(
  keys: K[],
  values: V[]
): Partial<Record<K, V>> {
  const result: Partial<Record<K, V>> = {};
  keys.forEach((key, index) => {
    result[key] = values[index];
  });
  return result;
}
