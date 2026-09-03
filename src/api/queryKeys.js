export const queryKeys = Object.freeze({
  me: () => ['me'],
  privacyPolicy: () => ['legal', 'privacy-policy'],
  sessions: () => ['sessions'],
  households: {
    all: () => ['households'],
    detail: (householdId) => ['households', 'detail', householdId],
  },
  categories: {
    all: (householdId) => ['householdCategories', householdId],
    list: (householdId, { includeArchived = false } = {}) =>
      includeArchived
        ? ['householdCategories', householdId, { includeArchived: true }]
        : ['householdCategories', householdId],
  },
  dashboard: (householdId, period) => ['dashboard', householdId, period],
  recurringExpenses: {
    all: (householdId) => ['recurringExpenses', householdId],
    detail: (householdId, expenseId) => [
      'recurringExpenses',
      householdId,
      'detail',
      expenseId,
    ],
    payments: (householdId, expenseId) => [
      'recurringExpenses',
      householdId,
      'payments',
      expenseId,
    ],
    reminderRules: (householdId, expenseId) => [
      'recurringExpenses',
      householdId,
      'reminderRules',
      expenseId,
    ],
  },
  invoices: {
    all: (householdId, filters = {}) => ['invoices', householdId, filters],
    detail: (householdId, invoiceId) => [
      'invoices',
      householdId,
      'detail',
      invoiceId,
    ],
    documents: (householdId, invoiceId) => [
      'invoices',
      householdId,
      'documents',
      invoiceId,
    ],
  },
  variableExpenses: {
    all: (householdId, period) => [
      'variableExpenses',
      householdId,
      period,
    ],
    detail: (householdId, expenseId) => [
      'variableExpenses',
      householdId,
      'detail',
      expenseId,
    ],
  },
  monthlyPlanning: {
    all: (householdId) => ['monthlyPlanning', householdId],
    detail: (householdId, period) => [
      'monthlyPlanning',
      householdId,
      period,
    ],
  },
  calendar: (householdId, period) => ['calendar', householdId, period],
  notifications: {
    all: () => ['notifications'],
    unreadCount: () => ['notifications', 'unreadCount'],
  },
});
