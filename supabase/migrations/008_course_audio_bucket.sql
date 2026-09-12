-- Public, read-only bucket for course audio previously committed under
-- data/audio/. Populated by scripts/uploadCourseAudio.js with the service
-- role; no insert/update policies, so app clients can only read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-audio', 'course-audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do nothing;
