import { createContext } from 'react';

/** @type {import('react').Context<{
 * session: { token: string, expiresAt: string, user: { id: number, username: string, role: string } } | null,
 * user: { id: number, username: string, role: string } | null,
 * login: (session: { token: string, expiresAt: string, user: { id: number, username: string, role: string } }) => void,
 * logout: () => Promise<void>
 * }>} */
export const AuthContext = createContext({ session: null, user: null, login: () => {}, logout: async () => {} });
