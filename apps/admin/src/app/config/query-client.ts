import { keepPreviousData, QueryClient } from '@tanstack/react-query';

/**
 * The app's one query cache, set up as Refine would set it up itself, but held here so that
 * signing out can empty it: the next person in this tab must not see, even for a moment, data or
 * an identity cached for the previous one.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, placeholderData: keepPreviousData },
  },
});
