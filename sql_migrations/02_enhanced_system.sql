-- Consolidating and enhancing the schema for "Maktabaty"

-- Ensure 'profiles' table has all required fields
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  account_type TEXT DEFAULT 'guest' CHECK (account_type IN ('guest', 'verified')),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'reviewer', 'admin')),
  is_scholar BOOLEAN DEFAULT false,
  phone TEXT UNIQUE,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Core Library Tables
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  icon TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS texts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  hadith_number TEXT NOT NULL,
  matn TEXT NOT NULL,
  chapter TEXT,
  isnad TEXT,
  volume TEXT,
  page TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS footnotes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  hadith_number TEXT,
  category TEXT, -- 'تخريج', 'فروق نسخ', 'غريب'
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scholarly Assets
CREATE TABLE IF NOT EXISTS manuscripts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  library TEXT,
  image_url TEXT,
  notes TEXT,
  author_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  publisher TEXT,
  image_url TEXT,
  notes TEXT,
  author_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Social & Interactive Tables
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type TEXT CHECK (post_type IN ('حديث', 'فائدة', 'سؤال', 'اقتباس', 'تحقيق', 'فيديو')),
  content TEXT NOT NULL,
  track TEXT DEFAULT 'عام',
  likes INTEGER DEFAULT 0,
  book_id TEXT, -- Optional link to library
  text_id TEXT, -- Optional link to specific hadith
  media_url TEXT, -- For Video/Reels
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  book_id TEXT, -- For library-specific comments
  hadith_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS likes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

-- Fix/Rename user_edits from 01 if it existed differently
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_edits') THEN
    -- In case columns were different in 01
    ALTER TABLE user_edits RENAME COLUMN edited_content TO edited_matn;
    ALTER TABLE user_edits RENAME COLUMN footnotes TO custom_footnotes;
  ELSE
    CREATE TABLE user_edits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL,
      hadith_number TEXT,
      edited_matn TEXT,
      custom_footnotes JSONB, -- Array of {num, text}
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE footnotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_edits ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Public read for most, Auth write)
CREATE POLICY "Public Read Profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public Read Books" ON books FOR SELECT USING (true);
CREATE POLICY "Public Read Texts" ON texts FOR SELECT USING (true);
CREATE POLICY "Public Read Footnotes" ON footnotes FOR SELECT USING (true);

CREATE POLICY "Read Approved Manuscripts" ON manuscripts FOR SELECT USING (status = 'approved' OR author_id = auth.uid());
CREATE POLICY "Read Approved Editions" ON editions FOR SELECT USING (status = 'approved' OR author_id = auth.uid());

CREATE POLICY "Public Read Posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Auth Write Posts" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auth Update/Delete Posts" ON posts FOR ALL USING (auth.uid() = author_id);

CREATE POLICY "Public Read Comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Auth Write Comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Public Read Likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Auth Toggle Likes" ON likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public Read Follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Auth Toggle Follows" ON follows FOR ALL USING (auth.uid() = follower_id);
