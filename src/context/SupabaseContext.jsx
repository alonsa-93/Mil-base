import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';

const SupabaseContext = createContext(null);

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export function SupabaseProvider({ children }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    // Set the session with the JWT token
    supabase.auth.setSession({
      access_token: token,
      refresh_token: token,
    }).then(() => {
      setConnected(true);
    }).catch(() => {
      setConnected(false);
    });
  }, [token]);

  return (
    <SupabaseContext.Provider value={{ supabase, connected }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
};
