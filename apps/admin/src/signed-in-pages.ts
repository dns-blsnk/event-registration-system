import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const RETRY_DELAY_MS = 1000;

/**
 * React.lazy that tries a failed download once more after a pause (a network blip). React keeps
 * a failed import for good, so without this one hiccup would break that screen until a reload.
 * If the retry fails too (a new deploy removed the old chunk), the error screen offers a reload.
 */
export function lazyScreen(load: () => Promise<ComponentType>): LazyExoticComponent<ComponentType> {
  return lazy(async () => {
    try {
      return { default: await load() };
    } catch {
      // Expected when offline for a moment: wait, then try once more and let that outcome stand.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return { default: await load() };
    }
  });
}

/**
 * The signed-in screens, each in its own chunk: nothing here is downloaded before sign-in, and a
 * screen's code arrives on its first visit. Named exports are mapped to what React.lazy expects.
 */
export const SignedInLayout = lazyScreen(
  async () => (await import('./signed-in-layout')).SignedInLayout,
);
export const DashboardPage = lazyScreen(
  async () => (await import('./pages/dashboard/dashboard-page')).DashboardPage,
);
export const EventList = lazyScreen(
  async () => (await import('./pages/events/event-list')).EventList,
);
export const EventCreate = lazyScreen(
  async () => (await import('./pages/events/event-create')).EventCreate,
);
export const EventShow = lazyScreen(
  async () => (await import('./pages/events/event-show')).EventShow,
);
export const EventEdit = lazyScreen(
  async () => (await import('./pages/events/event-edit')).EventEdit,
);
export const SessionList = lazyScreen(
  async () => (await import('./pages/sessions/session-list')).SessionList,
);
export const SessionShow = lazyScreen(
  async () => (await import('./pages/sessions/session-show')).SessionShow,
);
export const RegistrationList = lazyScreen(
  async () => (await import('./pages/registrations/registration-list')).RegistrationList,
);
export const CustomerList = lazyScreen(
  async () => (await import('./pages/customers/customer-list')).CustomerList,
);
export const TagList = lazyScreen(async () => (await import('./pages/tags/tag-list')).TagList);
export const UserList = lazyScreen(async () => (await import('./pages/users/user-list')).UserList);
export const CatalogList = lazyScreen(
  async () => (await import('./pages/catalog/catalog-list')).CatalogList,
);
export const CatalogShow = lazyScreen(
  async () => (await import('./pages/catalog/catalog-show')).CatalogShow,
);
export const MyRegistrationList = lazyScreen(
  async () => (await import('./pages/my-registrations/my-registration-list')).MyRegistrationList,
);
export const AppLogList = lazyScreen(
  async () => (await import('./pages/app-logs/app-log-list')).AppLogList,
);
export const AppLogShow = lazyScreen(
  async () => (await import('./pages/app-logs/app-log-show')).AppLogShow,
);
export const ForbiddenPage = lazyScreen(
  async () => (await import('./pages/errors/forbidden-page')).ForbiddenPage,
);
