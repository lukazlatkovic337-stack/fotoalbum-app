let counter = 0;

/**
 * Generiše jednostavan, dovoljno jedinstven id za elemente unutar editora
 * (strane albuma, tekstualne/foto elemente). Ne mora biti kriptografski
 * jedinstven — koristi se samo lokalno u okviru jednog albuma.
 */
export function uid(prefix = "id") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
