import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Whether the signed-in user may use Plaid bank sync: their email is in
 * public.plaid_access (migration 20261126120000_plaid_access.sql).
 *
 * This only decides what the dashboard shows. The plaid-link and plaid-sync
 * functions enforce the same list on the server, so hiding is never the only
 * protection. Fails closed: while loading, or on any error, it's false.
 *
 * @returns {{ loading: boolean, allowed: boolean }}
 */
export function usePlaidAccess() {
    const [state, setState] = useState({ loading: true, allowed: false });

    useEffect(() => {
        let live = true;
        supabase.rpc('has_plaid_access').then(({ data, error }) => {
            if (error) console.error('Checking Plaid access failed:', error);
            if (live) setState({ loading: false, allowed: !error && data === true });
        });
        return () => { live = false; };
    }, []);

    return state;
}
