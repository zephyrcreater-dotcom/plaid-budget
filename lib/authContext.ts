import React from 'react';

export const AuthContext = React.createContext({
  isAuthLoading: true,
  session: null as any,
  user: null as any,
});

export function useAuth() {
  return React.useContext(AuthContext);
}
