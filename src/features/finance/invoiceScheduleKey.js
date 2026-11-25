export const invoiceScheduleKey = (householdId) => ['invoiceSchedules', householdId];

// The calendar links an expected bill as /facturas?periodica=<id>. Read from
// window.location, like startsWithNewForm, so the page works outside a router.
export function linkedInvoiceScheduleId() {
  try {
    return new URLSearchParams(window.location.search).get('periodica');
  } catch {
    return null;
  }
}
