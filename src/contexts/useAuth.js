import { useContext } from 'react';
import { AuthContext } from './contextInstance';

export const useAuth = () => useContext(AuthContext);
