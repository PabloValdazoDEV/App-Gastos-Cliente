import { http } from '../../api/client';
import { getInvoiceDocumentContentType } from './invoiceDocumentSchema';

const home = (householdId) => `/households/${householdId}`;

export const financeService = {
  dashboard: (householdId) => http.get(`${home(householdId)}/dashboard`),
  budget: (householdId) => http.get(`${home(householdId)}/budget`),
  updateBalance: ({ householdId, balanceCents }) =>
    http.patch(`${home(householdId)}/balance`, { balanceCents }),

  recurring: (householdId) => http.get(`${home(householdId)}/recurring-expenses`),
  createRecurring: ({ householdId, body }) =>
    http.post(`${home(householdId)}/recurring-expenses`, body),
  updateRecurring: ({ householdId, expenseId, body }) =>
    http.patch(`${home(householdId)}/recurring-expenses/${expenseId}`, body),
  deleteRecurring: ({ householdId, expenseId }) =>
    http.delete(`${home(householdId)}/recurring-expenses/${expenseId}`),
  registerPayment: ({ householdId, expenseId, body }) =>
    http.post(`${home(householdId)}/recurring-expenses/${expenseId}/payments`, body),
  updateRecurringPayment: ({ householdId, expenseId, paymentId, body }) =>
    http.patch(
      `${home(householdId)}/recurring-expenses/${expenseId}/payments/${paymentId}`,
      body,
    ),
  recurringPayments: ({ householdId, expenseId }) =>
    http.get(`${home(householdId)}/recurring-expenses/${expenseId}/payments`),
  reminderRules: ({ householdId, expenseId }) =>
    http.get(`${home(householdId)}/recurring-expenses/${expenseId}/reminder-rules`),
  updateReminderRules: ({ householdId, expenseId, rules }) =>
    http.put(`${home(householdId)}/recurring-expenses/${expenseId}/reminder-rules`, {
      rules,
    }),

  invoices: (householdId) => http.get(`${home(householdId)}/invoices`),
  invoiceStatistics: (householdId) =>
    http.get(`${home(householdId)}/invoices/statistics`),
  createInvoice: ({ householdId, body }) =>
    http.post(`${home(householdId)}/invoices`, body),
  updateInvoice: ({ householdId, invoiceId, body }) =>
    http.patch(`${home(householdId)}/invoices/${invoiceId}`, body),
  deleteInvoice: ({ householdId, invoiceId }) =>
    http.delete(`${home(householdId)}/invoices/${invoiceId}`),
  async invoiceDocuments({ householdId, invoiceId }) {
    const data = await http.get(
      `${home(householdId)}/invoices/${invoiceId}/documents`,
    );
    return Array.isArray(data) ? data : data?.documents ?? [];
  },
  uploadInvoiceDocument: ({ file, householdId, invoiceId }) =>
    http.post(
      `${home(householdId)}/invoices/${invoiceId}/documents`,
      file,
      {
        headers: {
          'Content-Type': getInvoiceDocumentContentType(file),
          'X-Document-Filename': encodeURIComponent(file.name),
        },
        timeout: 60_000,
      },
    ),
  invoiceDocumentContent: ({ documentId, householdId, invoiceId }) =>
    http.get(
      `${home(householdId)}/invoices/${invoiceId}/documents/${documentId}/content`,
      { responseType: 'blob', timeout: 60_000 },
    ),
  deleteInvoiceDocument: ({ documentId, householdId, invoiceId }) =>
    http.delete(
      `${home(householdId)}/invoices/${invoiceId}/documents/${documentId}`,
    ),

  variableExpenses: (householdId) =>
    http.get(`${home(householdId)}/variable-expenses`),
  variableStatistics: (householdId) =>
    http.get(`${home(householdId)}/variable-expenses/statistics`),
  saveVariableMonth: ({ householdId, body }) =>
    http.put(`${home(householdId)}/variable-expenses/month`, body),
  deleteVariableMonth: ({ householdId, variableMonthId }) =>
    http.delete(`${home(householdId)}/variable-expenses/${variableMonthId}`),

  oneTimeExpenses: (householdId) =>
    http.get(`${home(householdId)}/one-time-expenses`),
  createOneTimeExpense: ({ householdId, body }) =>
    http.post(`${home(householdId)}/one-time-expenses`, body),
  updateOneTimeExpense: ({ householdId, expenseId, body }) =>
    http.patch(`${home(householdId)}/one-time-expenses/${expenseId}`, body),
  deleteOneTimeExpense: ({ householdId, expenseId }) =>
    http.delete(`${home(householdId)}/one-time-expenses/${expenseId}`),

  accounts: (householdId) => http.get(`${home(householdId)}/accounts`),
  createAccount: ({ householdId, body }) =>
    http.post(`${home(householdId)}/accounts`, body),
  updateAccount: ({ householdId, accountId, body }) =>
    http.patch(`${home(householdId)}/accounts/${accountId}`, body),
  deleteAccount: ({ householdId, accountId }) =>
    http.delete(`${home(householdId)}/accounts/${accountId}`),

  calendar: (householdId, view = '30_DAYS') =>
    http.get(`${home(householdId)}/calendar`, { params: { view } }),
  plannings: (householdId) => http.get(`${home(householdId)}/plannings`),
  prepareMonth: ({ householdId, body }) =>
    http.post(`${home(householdId)}/plannings/prepare`, body),
  fundPlanning: ({ householdId, planningId }) =>
    http.patch(`${home(householdId)}/plannings/${planningId}/fund`, {}),
  simulation: (householdId, date, balanceCents) =>
    http.get(`${home(householdId)}/simulation`, {
      params: { date, ...(balanceCents === undefined ? {} : { balanceCents }) },
    }),
  previewRecovery: ({ householdId, body }) =>
    http.post(`${home(householdId)}/recovery-plans/preview`, body),
  createRecovery: ({ householdId, body }) =>
    http.post(`${home(householdId)}/recovery-plans`, body),
  recoveryPlans: (householdId) => http.get(`${home(householdId)}/recovery-plans`),
  updateRecovery: ({ householdId, recoveryPlanId, status }) =>
    http.patch(`${home(householdId)}/recovery-plans/${recoveryPlanId}`, { status }),
};
