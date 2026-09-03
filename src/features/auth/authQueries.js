import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../api/queryKeys';
import { authService, resetAuthTransport } from './authService';

export function useCurrentUserQuery(options = {}) {
  return useQuery({
    queryFn: authService.getCurrentUser,
    queryKey: queryKeys.me(),
    retry: false,
    staleTime: 60_000,
    ...options,
  });
}

function useSessionMutation(mutationFn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me(), user);
    },
  });
}

export function useLoginMutation() {
  return useSessionMutation(authService.login);
}

export function useRegisterMutation() {
  return useSessionMutation(authService.register);
}

export function useGoogleLinkMutation() {
  return useSessionMutation(authService.confirmGoogleLink);
}

export function useLogoutMutation({ allDevices = false } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: allDevices ? authService.logoutAll : authService.logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: authService.forgotPassword });
}

export function useResetPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => clearSessionCache(queryClient),
  });
}

export function useSessionsQuery() {
  return useQuery({
    queryFn: authService.getSessions,
    queryKey: queryKeys.sessions(),
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

export function clearSessionCache(queryClient) {
  resetAuthTransport();
  queryClient.clear();
}
