import { describe, expect, it } from 'vitest';
import { applyKey, toKeypadValue, type KeypadKey } from './keypadInput';

function type(keys: KeypadKey[], start = ''): string {
  return keys.reduce((value, key) => applyKey(value, key), start);
}

describe('pavé numérique', () => {
  it('compose un poids à la française', () => {
    expect(type(['9', '0', ',', '2'])).toBe('90,2');
  });

  it('commence par « 0, » quand la virgule vient en premier', () => {
    expect(type([',', '5'])).toBe('0,5');
  });

  it('refuse une seconde virgule et limite les décimales à deux', () => {
    expect(type(['8', '9', ',', '4', ',', '5', '6'])).toBe('89,45');
  });

  it('limite la partie entière à trois chiffres', () => {
    expect(type(['1', '2', '3', '4'])).toBe('123');
  });

  it('remplace un zéro initial', () => {
    expect(type(['0', '9'])).toBe('9');
  });

  it('efface le dernier caractère, puis rien quand la saisie est vide', () => {
    expect(type(['9', '0', ',', 'back', 'back'])).toBe('9');
    expect(applyKey('', 'back')).toBe('');
  });

  it('reprend une valeur enregistrée sans zéros inutiles', () => {
    expect(toKeypadValue(90.2)).toBe('90,2');
    expect(toKeypadValue(90)).toBe('90');
    expect(toKeypadValue(89.45)).toBe('89,45');
  });
});
