-- 1. Create 'follows' table for follower relationships
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

-- 2. Create 'user_edits' table for personal annotations and edits
CREATE TABLE IF NOT EXISTS user_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  hadith_number TEXT,
  original_hadith_text TEXT,
  edited_content TEXT,
  footnotes JSONB, -- Array of {num, text}
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add new columns to profiles if not exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'guest' CHECK (account_type IN ('guest', 'verified')),
ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'committee_member', 'admin'));

-- 4. Enable RLS on new tables
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_edits ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for 'follows'
CREATE POLICY "Anyone can read follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can create their own follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- 6. RLS Policies for 'user_edits'
CREATE POLICY "Anyone can read approved/public edits" ON user_edits FOR SELECT USING (
  status = 'approved' OR user_id = auth.uid()
);
CREATE POLICY "Users can create their own edits" ON user_edits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own edits" ON user_edits FOR UPDATE USING (auth.uid() = user_id);

-- 7. Create index for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_user_edits_user ON user_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_edits_status ON user_edits(status);
