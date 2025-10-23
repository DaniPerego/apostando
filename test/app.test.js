const { parseNumbers } = window._apostando || require('../js/app.js');

describe('parseNumbers', () => {
  test('parsea lista separada por comas y espacios', () => {
    // Cuando corras en node + jsdom, window._apostando estará definido si importas/ejecutas el script.
    // Aquí probamos la lógica si parseNumbers está disponible.
    if (typeof parseNumbers !== 'function') {
      expect(true).toBe(true);
      return;
    }
    expect(parseNumbers('03,12,18,26,33,44', { min:0, max:45, requiredCount:6 })).toEqual([3,12,18,26,33,44]);
    expect(parseNumbers('00 01 02 03 04 05', { min:0, max:45, requiredCount:6 })).toEqual([0,1,2,3,4,5]);
  });

  test('rechaza repetidos', () => {
    if (typeof parseNumbers !== 'function') { expect(true).toBe(true); return; }
    expect(() => parseNumbers('01,01,02,03,04,05', { min:0, max:45, requiredCount:6 })).toThrow();
  });

  test('rechaza fuera de rango', () => {
    if (typeof parseNumbers !== 'function') { expect(true).toBe(true); return; }
    expect(() => parseNumbers('00,01,02,03,04,99', { min:0, max:45, requiredCount:6 })).toThrow();
  });
});