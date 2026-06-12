import React, { useEffect, useState } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const LoginPage: NextPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const existingSession = supabase.auth.session();

    if (existingSession) {
      router.replace('/');
    }
  }, [router]);

  async function handleLogin() {
    setIsLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signIn({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/');
  }

  async function handleSignUp() {
    setIsLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/');
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg p-8">
        <p className="mb-2 text-sm uppercase tracking-widest text-gray-500 dark:text-neutral-300">
          Welcome Back
        </p>
        <h1 className="mt-0 mb-6 text-4xl font-bold border-b-0 pb-0">Budget App</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-3 text-base"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-3 text-base"
              placeholder="Enter your password"
            />
          </div>
        </div>
        {errorMessage ? (
          <p className="mt-4 mb-0 text-base text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 grid gap-3">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Login'}
          </button>
          <button
            onClick={handleSignUp}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-700 font-bold py-3 px-4 disabled:opacity-50"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
