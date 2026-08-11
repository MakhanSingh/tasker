-- The bucket uploads move into, so a file outlives the deploy that follows it.
--
-- Local disk was only ever safe on a VPS with a persistent volume mounted
-- outside the checkout. In practice STORAGE_ROOT stayed at its default of
-- ./storage, inside the repo, and the next deploy sat on top of it — rows in
-- `files` pointing at bytes that were no longer anywhere.
--
-- Private on purpose. Nothing reads this bucket directly: downloads keep going
-- through /api/files/[fileId]/download, which asks RLS on the `files` row who
-- is allowed to see it and only then streams. A public bucket would hand out
-- every attachment to anyone who could guess a path, with no RLS in the way.
--
-- No policies on storage.objects are needed to go with it. The app reaches
-- storage with the service-role key, which bypasses RLS, and the `authenticated`
-- role is never given a direct path to the bucket at all.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
