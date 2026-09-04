import { http } from '../../api/client';

export const householdService = {
  list: () => http.get('/households'),
  get: (householdId) => http.get(`/households/${householdId}`),
  create: (body) => http.post('/households', body),
  update: ({ householdId, body }) => http.patch(`/households/${householdId}`, body),
  listPeople: (householdId) => http.get(`/households/${householdId}/people`),
  createPerson: ({ householdId, body }) =>
    http.post(`/households/${householdId}/people`, body),
  updateDistribution: ({ householdId, body }) =>
    http.put(`/households/${householdId}/people/distribution`, body),
  listCategories: (householdId, { includeArchived = false } = {}) =>
    http.get(`/households/${householdId}/categories`, {
      params: includeArchived ? { includeArchived: true } : undefined,
    }),
  createCategory: ({ householdId, body }) =>
    http.post(`/households/${householdId}/categories`, body),
  updateCategory: ({ householdId, categoryId, body }) =>
    http.patch(`/households/${householdId}/categories/${categoryId}`, body),
  archiveCategory: ({ householdId, categoryId }) =>
    http.post(`/households/${householdId}/categories/${categoryId}/archive`, {}),
  deleteCategory: ({ householdId, categoryId }) =>
    http.delete(`/households/${householdId}/categories/${categoryId}`),
  listInvitations: (householdId) =>
    http.get(`/households/${householdId}/invitations`),
  invite: ({ householdId, body }) =>
    http.post(`/households/${householdId}/invitations`, body),
  revokeInvitation: ({ householdId, invitationId }) =>
    http.delete(`/households/${householdId}/invitations/${invitationId}`),
};
