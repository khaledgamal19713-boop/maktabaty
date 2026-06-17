-- RLS policies (suggested) for core tables
-- Load this file in Supabase SQL editor or as part of migrations after enabling RLS on each table

-- Enable RLS on core tables
ALTER TABLE IF EXISTS posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS footnotes ENABLE ROW LEVEL SECURITY;

-- POSTS
-- Anyone can read posts
CREATE POLICY IF NOT EXISTS "public_read_posts" ON posts FOR SELECT USING (true);
-- Authenticated users can insert posts as themselves
CREATE POLICY IF NOT EXISTS "insert_own_post" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can update/delete only their own posts
CREATE POLICY IF NOT_EXISTS "update_own_post" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT_EXISTS "delete_own_post" ON posts FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS
CREATE POLICY IF NOT EXISTS "public_read_comments" ON comments FOR SELECT USING (true);
CREATE POLICY IF NOT_EXISTS "insert_own_comment" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT_EXISTS "update_own_comment" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT_EXISTS "delete_own_comment" ON comments FOR DELETE USING (auth.uid() = user_id);

-- LIKES
CREATE POLICY IF NOT EXISTS "insert_like" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT_EXISTS "delete_like" ON likes FOR DELETE USING (auth.uid() = user_id);
-- Allow reading likes count publicly
CREATE POLICY IF NOT_EXISTS "read_likes" ON likes FOR SELECT USING (true);

-- PROFILES
-- Public can read limited profile fields via a view or policy (here: allow select)
CREATE POLICY IF NOT_EXISTS "public_read_profiles" ON profiles FOR SELECT USING (true);
-- Users can update their own profile
CREATE POLICY IF NOT_EXISTS "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- USER_EDITS (already had some policies but ensure consistency)
CREATE POLICY IF NOT_EXISTS "select_user_edits" ON user_edits FOR SELECT USING (
  status = 'approved' OR user_id = auth.uid()
);
CREATE POLICY IF NOT_EXISTS "insert_user_edits" ON user_edits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT_EXISTS "update_user_edits" ON user_edits FOR UPDATE USING (auth.uid() = user_id OR EXISTS(
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.account_type = 'verified' AND p.is_scholar = true
));

-- FOLLOWS (keep existing rules)
CREATE POLICY IF NOT_EXISTS "read_follows" ON follows FOR SELECT USING (true);
CREATE POLICY IF NOT_EXISTS "insert_follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY IF NOT_EXISTS "delete_follows" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- MANUSCRIPTS & EDITIONS & FOOTNOTES
-- Readable by public
CREATE POLICY IF NOT_EXISTS "read_manuscripts" ON manuscripts FOR SELECT USING (true);
CREATE POLICY IF NOT_EXISTS "insert_manuscripts_verified" ON manuscripts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.account_type = 'verified')
);
CREATE POLICY IF NOT_EXISTS "read_editions" ON editions FOR SELECT USING (true);
CREATE POLICY IF NOT_EXISTS "read_footnotes" ON footnotes FOR SELECT USING (true);

-- Notes:
-- - Adjust policies for admin/committee roles by checking profiles.role or a role table.
-- - auth.role() is Supabase function for JWT role; ensure JWT contains role claim if used.
-- - For stricter privacy, replace public read policies with conditions.
