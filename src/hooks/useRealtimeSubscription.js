/**
 * useRealtimeSubscription.js
 *
 * Generic Supabase Realtime hook for postgres_changes events.
 *
 * SECURITY NOTE:
 *   Realtime works with the anon key IF RLS SELECT policy allows it.
 *   With deny-all RLS (our current setup), events require either:
 *     A) Supabase Auth integration (user's JWT is passed to Supabase)
 *     B) Temporarily enable SELECT for authenticated role (see 01_rls_policies.sql)
 *
 *   For now the hook is wired up and ready — enable RLS Option B to activate.
 *
 * USAGE:
 *   const { data, error } = useRealtimeSubscription({
 *     table: 'soldiers',
 *     onInsert: (row) => setSoldiers(prev => [...prev, row]),
 *     onUpdate: (row) => setSoldiers(prev => prev.map(s => s.id === row.id ? row : s)),
 *     onDelete: (row) => setSoldiers(prev => prev.filter(s => s.id !== row.id)),
 *   });
 */

import { useEffect, useRef, useState } from 'react';
import { useSupabase } from '../context/SupabaseContext';

/**
 * @param {Object}   options
 * @param {string}   options.table     - Supabase table name
 * @param {string}   [options.filter]  - Optional PostgREST filter, e.g. 'status=eq.זמין'
 * @param {Function} [options.onInsert]
 * @param {Function} [options.onUpdate]
 * @param {Function} [options.onDelete]
 * @param {boolean}  [options.enabled] - Set false to disable subscription
 */
export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}) {
  const { supabase, connected } = useSupabase();
  const channelRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | subscribing | subscribed | error

  useEffect(() => {
    if (!enabled || !connected || !supabase) return;

    setStatus('subscribing');

    const channelName = filter
      ? `rt:${table}:${filter}`
      : `rt:${table}`;

    const channelConfig = {
      event:  '*',
      schema: 'public',
      table,
      ...(filter ? { filter } : {}),
    };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload.new);
            break;
          case 'UPDATE':
            onUpdate?.(payload.new, payload.old);
            break;
          case 'DELETE':
            onDelete?.(payload.old);
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('error');
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setStatus('idle');
    };
  }, [table, filter, enabled, connected, supabase]);

  return { status };
}


// ─────────────────────────────────────────────────────────────────────────────
// PRE-BUILT HOOKS for each entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keeps a soldiers list in sync with Supabase Realtime.
 * @param {Function} setSoldiers - React state setter
 *
 * USAGE:
 *   const [soldiers, setSoldiers] = useState([]);
 *   useSoldiersRealtime(setSoldiers);
 */
export function useSoldiersRealtime(setSoldiers) {
  return useRealtimeSubscription({
    table: 'soldiers',
    onInsert: (row) =>
      setSoldiers(prev => [...prev, row].sort((a, b) => a.serial_num - b.serial_num)),
    onUpdate: (row) =>
      setSoldiers(prev => prev.map(s => s.id === row.id ? row : s)),
    onDelete: (row) =>
      setSoldiers(prev => prev.filter(s => s.id !== row.id)),
  });
}

/**
 * Keeps a missions list in sync.
 */
export function useMissionsRealtime(setMissions) {
  return useRealtimeSubscription({
    table: 'missions',
    onInsert: (row) =>
      setMissions(prev => [...prev, row].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
      )),
    onUpdate: (row) =>
      setMissions(prev => prev.map(m => m.id === row.id ? row : m)),
    onDelete: (row) =>
      setMissions(prev => prev.filter(m => m.id !== row.id)),
  });
}

/**
 * Fires a callback whenever any assignment changes.
 * Useful for mission detail view to stay up-to-date.
 * @param {Function} onAnyChange - callback(payload)
 */
export function useAssignmentsRealtime(onAnyChange) {
  return useRealtimeSubscription({
    table: 'assignments',
    onInsert: onAnyChange,
    onUpdate: onAnyChange,
    onDelete: onAnyChange,
  });
}
