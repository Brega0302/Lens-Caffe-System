import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./contextInstance";
const readStored = () => {
  try {
    const token = sessionStorage.getItem("lensos.token");
    const user = sessionStorage.getItem("lensos.user");
    const expiresAt = sessionStorage.getItem("lensos.expiresAt");
    if (
      !token ||
      !user ||
      !expiresAt ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.now()
    )
      return null;
    return { token, user: JSON.parse(user), expiresAt };
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStored);
  const login = useCallback((next) => {
    const value = {
      token: next.token,
      user: next.user,
      expiresAt: next.expiresAt,
    };
    sessionStorage.setItem("lensos.token", value.token);
    sessionStorage.setItem("lensos.user", JSON.stringify(value.user));
    sessionStorage.setItem("lensos.expiresAt", value.expiresAt);
    setSession(value);
  }, []);
  const logout = useCallback(async () => {
    const token = session?.token;
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* clear local session even while offline */
      }
    }
    sessionStorage.removeItem("lensos.token");
    sessionStorage.removeItem("lensos.user");
    sessionStorage.removeItem("lensos.expiresAt");
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("lensos.pending:")) sessionStorage.removeItem(key);
    setSession(null);
  }, [session?.token]);
  useEffect(() => {
    const expired = () => {
      void logout();
    };
    window.addEventListener("lensos:unauthorized", expired);
    const timer = session
      ? setTimeout(
          expired,
          Math.max(0, Date.parse(session.expiresAt) - Date.now()),
        )
      : undefined;
    return () => {
      window.removeEventListener("lensos:unauthorized", expired);
      clearTimeout(timer);
    };
  }, [logout, session]);
  const value = useMemo(
    () => ({ session, user: session?.user || null, login, logout }),
    [session, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
