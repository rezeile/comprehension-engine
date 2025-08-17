// Minimal fallback type declarations for react-router-dom to prevent TS compile errors
// when local environment cannot resolve bundled types. Runtime behavior uses the real package.

declare module 'react-router-dom' {
  import * as React from 'react';

  export const BrowserRouter: React.ComponentType<{ children?: React.ReactNode }>;
  export const Routes: React.ComponentType<{ children?: React.ReactNode }>;
  export const Route: React.ComponentType<{ path?: string; element?: React.ReactNode }>;
  export const Navigate: React.ComponentType<{ to: string; replace?: boolean }>;

  export function useNavigate(): (to: string, opts?: { replace?: boolean; state?: unknown }) => void;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;
}


