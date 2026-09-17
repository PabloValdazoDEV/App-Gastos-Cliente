import { describe, expect, it } from 'vitest';

import { filterPurchases, ownershipLabel, purchaseDateLabel, purchaseTitle } from './presentation';

const purchases = [
  { id: 'old', merchant: 'Electrónica', ownershipType: 'HOUSEHOLD', purchaseDate: '2026-08-01', items: [{ name: 'Televisión', brand: 'LG', model: 'OLED', warrantyStatus: 'EXPIRED' }] },
  { id: 'new', merchant: null, ownershipType: 'SPLIT', purchaseDate: '2026-09-17', items: [{ name: 'Monitor', warrantyStatus: 'ACTIVE' }, { name: 'Cable', brand: 'Anker', model: 'USB-C', warrantyStatus: 'NONE' }] },
];

describe('purchase presentation', () => {
  it('ordena sin mutar la respuesta API', () => {
    expect(filterPurchases(purchases).map(({ id }) => id)).toEqual(['new', 'old']);
    expect(purchases[0].id).toBe('old');
  });
  it.each(['television', ' ELECTRONICA ', 'oled'])('busca sin distinguir acentos/mayúsculas: %s', (search) => {
    expect(filterPurchases(purchases, { search }).map(({ id }) => id)).toEqual(['old']);
  });
  it.each(['Cable', 'Anker', 'USB-C'])('busca en todos los productos, no solo el principal: %s', (search) => {
    expect(filterPurchases(purchases, { search }).map(({ id }) => id)).toEqual(['new']);
  });
  it.each([['NONE', 'new'], ['ACTIVE', 'new'], ['EXPIRED', 'old']])('filtra garantía %s por producto', (warranty, expected) => {
    expect(filterPurchases(purchases, { warranty }).map(({ id }) => id)).toEqual([expected]);
  });
  it('combina filtros sin agregar totales financieros', () => {
    expect(filterPurchases(purchases, { ownership: 'SPLIT', warranty: 'EXPIRED' })).toEqual([]);
    expect(filterPurchases(purchases, { ownership: 'SPLIT', warranty: 'NONE' })).toEqual([purchases[1]]);
  });
  it('formatea la fecha civil sin cambiar de día con la zona horaria', () => {
    expect(purchaseDateLabel('2026-09-17T00:00:00.000Z')).toBe('17 sept 2026');
    expect(purchaseDateLabel(null)).toBe('Sin fecha');
    expect(purchaseDateLabel('inválida')).toBe('Fecha no disponible');
  });
  it('usa el producto principal y etiquetas comprensibles de propiedad', () => {
    expect(purchaseTitle(purchases[1])).toBe('Monitor');
    expect(purchaseTitle({})).toBe('Compra guardada');
    expect(ownershipLabel(purchases[0])).toBe('Del hogar');
    expect(ownershipLabel(purchases[1])).toBe('Repartida');
    expect(ownershipLabel({ ownershipType: 'PERSONAL', personalPerson: { name: 'Pablo' } })).toBe('Pablo');
  });
});
