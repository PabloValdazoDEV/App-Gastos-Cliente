import { lazy } from 'react';

export const AccountSessionsPage = lazy(() =>
  import('../pages/AccountSessionsPage').then((module) => ({
    default: module.AccountSessionsPage,
  })),
);
export const AccountsPage = lazy(() =>
  import('../pages/AccountsPage').then((module) => ({ default: module.AccountsPage })),
);
export const CalendarPage = lazy(() =>
  import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
);
export const BudgetPage = lazy(() =>
  import('../pages/BudgetPage').then((module) => ({ default: module.BudgetPage })),
);
export const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
export const ExpensesPage = lazy(() =>
  import('../pages/ExpensesPage').then((module) => ({ default: module.ExpensesPage })),
);
export const OneTimeExpensesPage = lazy(() =>
  import('../pages/OneTimeExpensesPage').then((module) => ({
    default: module.OneTimeExpensesPage,
  })),
);
export const HouseholdPage = lazy(() =>
  import('../pages/HouseholdPage').then((module) => ({ default: module.HouseholdPage })),
);
export const InvoicesPage = lazy(() =>
  import('../pages/InvoicesPage').then((module) => ({ default: module.InvoicesPage })),
);
export const InvitationAcceptPage = lazy(() =>
  import('../pages/InvitationAcceptPage').then((module) => ({
    default: module.InvitationAcceptPage,
  })),
);
export const MorePage = lazy(() =>
  import('../pages/MorePage').then((module) => ({ default: module.MorePage })),
);
export const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
export const NotificationsPage = lazy(() =>
  import('../pages/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
);
export const PlanningPage = lazy(() =>
  import('../pages/PlanningPage').then((module) => ({ default: module.PlanningPage })),
);
export const PurchasesPage = lazy(() =>
  import('../pages/PurchasesPage').then((module) => ({ default: module.PurchasesPage })),
);
export const PurchaseDetailsPage = lazy(() =>
  import('../pages/PurchaseDetailsPage').then((module) => ({ default: module.PurchaseDetailsPage })),
);
export const PrivacyPage = lazy(() =>
  import('../pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })),
);
export const SimulatorPage = lazy(() =>
  import('../pages/SimulatorPage').then((module) => ({ default: module.SimulatorPage })),
);
export const RecurringExpensesPage = lazy(() =>
  import('../pages/RecurringExpensesPage').then((module) => ({
    default: module.RecurringExpensesPage,
  })),
);
export const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
export const VariableExpensesPage = lazy(() =>
  import('../pages/VariableExpensesPage').then((module) => ({
    default: module.VariableExpensesPage,
  })),
);
export const ForgotPasswordPage = lazy(() =>
  import('../pages/auth/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
export const GoogleCallbackPage = lazy(() =>
  import('../pages/auth/GoogleCallbackPage').then((module) => ({
    default: module.GoogleCallbackPage,
  })),
);
export const LoginPage = lazy(() =>
  import('../pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
export const RegisterPage = lazy(() =>
  import('../pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
export const ResetPasswordPage = lazy(() =>
  import('../pages/auth/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
