import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { RegisterPayload } from '../api/auth';
import { saveSession, saveUser, clearSession, getToken, getStoredUser } from '../api/client';
import { registerForPushNotificationsAsync } from '../notifications';
import { registerPushToken } from '../api/push';

interface User {
  username: string;
  role: string;
  cedula?: string;
  email?: string;
  full_name?: string;
  sede?: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (updated: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser();
      if (token && storedUser && storedUser.role === 'client') {
        setUser(storedUser);
        // Valida en segundo plano que el token siga vigente
        authApi.verifySession().then((res) => {
          if (!res?.authenticated) {
            clearSession();
            setUser(null);
          }
        }).catch(() => {});
      } else if (token) {
        // Sesión de un rol no permitido en la app móvil (empleado/admin) — se descarta.
        await clearSession();
      }
      setInitializing(false);
    })();
  }, []);

  // Cada vez que hay un usuario autenticado, registra (o renueva) el push token
  // en el backend. No bloquea la sesión si falla (ej: sin EAS projectId configurado).
  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync()
      .then((expoPushToken) => {
        if (expoPushToken) registerPushToken(expoPushToken).catch(() => {});
      })
      .catch(() => {});
  }, [user?.username]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    if (data.user?.role !== 'client') {
      throw new Error(
        'Esta aplicación es solo para clientes. Los empleados y administradores deben ingresar desde la versión web.'
      );
    }
    await saveSession(data.token, data.user);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await authApi.registerClient(payload);
    await saveSession(data.token, data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    authApi.logout().catch(() => {});
  }, []);

  const refreshUser = useCallback(async (updated: Partial<User>) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...updated } : (updated as User);
      saveUser(next).catch(() => {});
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
