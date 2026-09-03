import { http } from '../../api/client';

export const notificationService = Object.freeze({
  list: () => http.get('/notifications?page=1&pageSize=100'),
  listUnread: () =>
    http.get('/notifications?page=1&pageSize=100&unreadOnly=true'),
  markRead: (notificationId) =>
    http.patch(`/notifications/${notificationId}/read`, {}),
  markAllRead: () => http.patch('/notifications/read-all', {}),
  getPreferences: () => http.get('/notification-preferences'),
  updatePreferences: (body) => http.patch('/notification-preferences', body),
});
