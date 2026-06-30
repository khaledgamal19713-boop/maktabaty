-- Final tuning for Maktabaty Scholarly Platform

-- 1. Ensure all social posts can be linked to library entities
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS book_id TEXT,
ADD COLUMN IF NOT EXISTS text_id TEXT;

-- 2. Add indices for fast lookup in news feed and library
CREATE INDEX IF NOT EXISTS idx_posts_book_text ON posts(book_id, text_id);
CREATE INDEX IF NOT EXISTS idx_comments_hadith ON comments(book_id, hadith_number);

-- 3. Update profiles for phone unique constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
  END IF;
END $$;

-- 4. Set default roles for first users or admin seeds if needed
-- (Handled via Supabase Dashboard usually, but keeping schema ready)

-- 5. Additional RLS for admin actions
CREATE POLICY "Admins can update anything"
ON user_edits
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'reviewer')
  )
);
