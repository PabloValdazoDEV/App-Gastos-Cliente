// Shared deterministic receipt fixtures for local UI tests (no provider calls).
export const receiptAnalysisFixture = {
  id: 'analysis', purchaseDocumentId: 'document', provider: 'OPENAI', model: 'configured-model',
  status: 'COMPLETED', purchaseVersion: 'version-1', createdAt: '2026-09-17T12:00:00Z',
  inputTokens: 100, outputTokens: 50, totalTokens: 150,
  extractedData: {
    documentType: 'RECEIPT', merchant: { name: 'Mercadona', confidence: 'HIGH' },
    purchaseDate: { value: '2026-09-17', confidence: 'MEDIUM' }, currency: 'EUR',
    subtotalCents: null, taxCents: null, discountCents: null, totalCents: 870,
    documentNumber: null, needsReview: true, warnings: [],
    items: [
      { name: 'Producto A', quantity: 1, unitPriceCents: 550, totalPriceCents: 550, brand: null, model: null, confidence: 'HIGH' },
      { name: 'Producto B', quantity: 1, unitPriceCents: 320, totalPriceCents: 320, brand: null, model: null, confidence: 'LOW' },
    ],
  },
};
export const analysisPurchaseFixture = { id: 'purchase', merchant: 'Tienda original', purchaseDate: '2026-09-16', totalCents: 900, paymentMethod: 'UPFRONT', paymentDate: null, paidAmountCents: null, items: [{ id: 'existing', name: 'Producto existente', quantity: 1, warrantyDurationMonths: 24 }] };
