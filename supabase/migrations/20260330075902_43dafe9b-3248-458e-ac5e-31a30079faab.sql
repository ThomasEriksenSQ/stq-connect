CREATE POLICY "Admin can delete website_applications"
ON public.website_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));