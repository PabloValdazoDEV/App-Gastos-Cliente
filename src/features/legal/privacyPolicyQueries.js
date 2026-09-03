import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../api/queryKeys';
import { privacyPolicyService } from './privacyPolicyService';

export function usePrivacyPolicyQuery() {
  return useQuery({
    queryFn: privacyPolicyService.getMetadata,
    queryKey: queryKeys.privacyPolicy(),
    retry: false,
    staleTime: 5 * 60_000,
  });
}
