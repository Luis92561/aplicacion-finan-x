import { createContext, useContext, useState } from 'react';

const AuthCtx = createContext(null);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('fx_user'));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  const login = (u, token) => {
    localStorage.setItem('fx_user', JSON.stringify(u));
    localStorage.setItem('fx_token', token);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('fx_user');
    localStorage.removeItem('fx_token');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);