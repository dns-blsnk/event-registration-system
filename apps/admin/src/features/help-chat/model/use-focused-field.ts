import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

/** The chat's own input is marked with this attribute, so typing a question keeps the field in focus. */
export const CHAT_INPUT_ATTRIBUTE = 'data-chat-input';

/**
 * The `name` of the form field the user was last in on this page, so a question can be about
 * "this field". Forgotten on navigation. A DOM subscription, which is what effects are for.
 */
export function useFocusedField(): string | undefined {
  const { pathname } = useLocation();
  const [focused, setFocused] = useState<{ pathname: string; name: string } | undefined>(undefined);
  // The router's path (not window.location), read by the listener without re-subscribing.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const remember = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.hasAttribute(CHAT_INPUT_ATTRIBUTE)) return;
      setFocused(
        target.name === '' ? undefined : { pathname: pathnameRef.current, name: target.name },
      );
    };
    document.addEventListener('focusin', remember);
    return () => {
      document.removeEventListener('focusin', remember);
    };
  }, []);
  // A field from another page is not "this field" any more.
  return focused?.pathname === pathname ? focused.name : undefined;
}
