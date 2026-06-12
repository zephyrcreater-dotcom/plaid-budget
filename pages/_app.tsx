import * as React from 'react';
import { useRouter } from 'next/router';

import '../styles/tailwind.css';
import { AuthContext } from '../lib/authContext';
import { supabase } from '../lib/supabaseClient';

const PROTECTED_ROUTES = ['/', '/dashboard', '/transactions', '/budget', '/investments', '/settings'];

function MyApp({ Component, pageProps }: any) {
  const router = useRouter();
  const [session, setSession] = React.useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  React.useEffect(() => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const htmlSelector = document.querySelector('html');

    if (!isDark.matches) {
      window.localStorage.setItem('THEME', 'light');
      htmlSelector?.classList.remove('mode-dark');
    } else {
      window.localStorage.setItem('THEME', 'dark');
      htmlSelector?.classList.add('mode-dark');
    }
  }, []);

  React.useEffect(() => {
    const currentSession = supabase.auth.session();
    setSession(currentSession);
    setIsAuthLoading(false);

    const { data } = supabase.auth.onAuthStateChange((_event: any, nextSession: any) => {
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      data?.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const isProtectedRoute = PROTECTED_ROUTES.includes(router.pathname);

    if (!session && isProtectedRoute) {
      router.replace('/login');
      return;
    }

    if (session && router.pathname === '/login') {
      router.replace('/');
    }
  }, [isAuthLoading, router, session]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 flex items-center justify-center">
        <p className="mb-0 text-xl">Loading your session...</p>
      </div>
    );
  }

  const isProtectedRoute = PROTECTED_ROUTES.includes(router.pathname);

  if (!session && isProtectedRoute) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthLoading,
        session,
        user: session?.user || null,
      }}
    >
      <Component {...pageProps} />
    </AuthContext.Provider>
  );
}

export default MyApp;
