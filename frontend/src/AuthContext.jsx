import { createContext, useEffect, useState } from 'react';
import { getProfile, devLogin as apiDevLogin, logoutUser as apiLogout } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

    const fetchUser = () => {
      setLoading(true);
      return getProfile()
        .then(res => setUser(res.data))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      fetchUser();
    }, []);

    const loginDevUser = async () => {
      setLoading(true);
      try {
        const res = await apiDevLogin();
        setUser(res.data?.user || { profile: { login: 'demo-developer', displayName: 'Demo Developer' } });
        return true;
      } catch (err) {
        console.error(err);
        return false;
      } finally {
        setLoading(false);
      }
    };

    const logout = async () => {
      try {
        await apiLogout();
      } catch { }
      setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, fetchUser, loginDevUser, logout }}>
          {children}
        </AuthContext.Provider>
        );
}

        export {AuthContext};
