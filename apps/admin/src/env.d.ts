/** Build-time settings of the admin (Vite exposes only VITE_-prefixed variables). */
interface ImportMetaEnv {
  /** Public URL of the API for the chat socket; empty means this origin (proxied in development). */
  readonly VITE_CHAT_URL?: string;
}
