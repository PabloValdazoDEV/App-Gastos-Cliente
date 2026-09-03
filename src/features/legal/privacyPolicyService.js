import { http } from '../../api/client';

export const privacyPolicyService = {
  getMetadata: () => http.get('/legal/privacy-policy'),
};
