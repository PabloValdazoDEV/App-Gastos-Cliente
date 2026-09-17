import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';

import { AppLayout } from '../components/layout/AppLayout';
import { PublicLayout } from '../components/layout/PublicLayout';
import { RouteLoading } from '../components/ui/RouteLoading';
import {
  PublicOnly,
  RequireAuth,
  SessionEventBoundary,
} from '../features/auth/AuthRouteGuards';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { HouseholdProvider } from '../features/households/HouseholdProvider';
import {
  AccountSessionsPage,
  AccountsPage,
  BudgetPage,
  CalendarPage,
  DashboardPage,
  ExpensesPage,
  ForgotPasswordPage,
  GoogleCallbackPage,
  HouseholdPage,
  InvoicesPage,
  InvitationAcceptPage,
  LoginPage,
  MorePage,
  NotFoundPage,
  NotificationsPage,
  OneTimeExpensesPage,
  PlanningPage,
  PurchasesPage,
  PurchaseDetailsPage,
  PrivacyPage,
  RecurringExpensesPage,
  RegisterPage,
  ResetPasswordPage,
  SettingsPage,
  SimulatorPage,
  VariableExpensesPage,
} from './lazyPages';

export const router = createBrowserRouter([
  {
    element: (
      <Suspense fallback={<RouteLoading />}>
        <SessionEventBoundary />
      </Suspense>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: 'privacidad',
        element: <PrivacyPage />,
      },
      {
        element: <PublicOnly />,
        children: [
          {
            element: <PublicLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: 'auth/callback', element: <GoogleCallbackPage /> },
          { path: 'auth/google/link', element: <GoogleCallbackPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
          { path: 'invitaciones/aceptar', element: <InvitationAcceptPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: (
              <HouseholdProvider>
                <AppLayout />
              </HouseholdProvider>
            ),
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'presupuesto', element: <BudgetPage /> },
              { path: 'gastos', element: <ExpensesPage /> },
              { path: 'gastos/recurrentes', element: <RecurringExpensesPage /> },
              { path: 'gastos/recurrentes/:expenseId', element: <RecurringExpensesPage /> },
              { path: 'gastos/variables', element: <VariableExpensesPage /> },
              { path: 'gastos/puntuales', element: <OneTimeExpensesPage /> },
              { path: 'facturas', element: <InvoicesPage /> },
              { path: 'calendario', element: <CalendarPage /> },
              { path: 'planificacion', element: <PlanningPage /> },
              { path: 'compras', element: <PurchasesPage /> },
              { path: 'compras/:purchaseId', element: <PurchaseDetailsPage /> },
              { path: 'simulador', element: <SimulatorPage /> },
              { path: 'notificaciones', element: <NotificationsPage /> },
              { path: 'hogar', element: <HouseholdPage /> },
              { path: 'ajustes', element: <SettingsPage /> },
              { path: 'mas', element: <MorePage /> },
              { path: 'cuentas', element: <AccountsPage /> },
              { path: 'mas/sesiones', element: <AccountSessionsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
