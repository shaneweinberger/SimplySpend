-- Feedback board admin: one hardcoded account can edit, move and delete any ticket.
--
-- Ticket owners keep whatever access they already have; these policies are
-- permissive, so Postgres ORs them with the existing ones and only *adds* the
-- admin's access. The check is enforced here, not just in the UI, so nobody else
-- can change another person's ticket by calling the API directly.
--
-- The email comes from the signed-in user's JWT. Supabase email addresses are
-- unique and a change of address has to be confirmed, so only the owner of this
-- inbox can hold it. To add an admin, add their email to the array below and to
-- FEEDBACK_ADMIN_EMAILS in src/components/dashboard/Feedback.jsx.

CREATE OR REPLACE FUNCTION public.is_feedback_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(lower(auth.jwt() ->> 'email'), '') = ANY (ARRAY[
        'dev.shanewein@gmail.com'
    ]);
$$;

GRANT EXECUTE ON FUNCTION public.is_feedback_admin() TO authenticated;

DROP POLICY IF EXISTS "Feedback admin can update any ticket" ON public.feedback_tickets;
CREATE POLICY "Feedback admin can update any ticket"
    ON public.feedback_tickets
    FOR UPDATE
    TO authenticated
    USING (public.is_feedback_admin())
    WITH CHECK (public.is_feedback_admin());

DROP POLICY IF EXISTS "Feedback admin can delete any ticket" ON public.feedback_tickets;
CREATE POLICY "Feedback admin can delete any ticket"
    ON public.feedback_tickets
    FOR DELETE
    TO authenticated
    USING (public.is_feedback_admin());

NOTIFY pgrst, 'reload schema';
