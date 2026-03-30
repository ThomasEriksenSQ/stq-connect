CREATE POLICY "Admin can delete website_leads"
ON public.website_leads
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));