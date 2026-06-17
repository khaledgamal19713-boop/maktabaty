-- 02_fix_profiles_and_core_tables.sql
-- مهاجرة: تصحيح جدول profiles وإضافة الجداول الأساسية المطلوبة للتطبيق

-- 1) إصلاح/إضافة أعمدة متوافقة مع الواجهة (front-end)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'guest' CHECK (account_type IN ('guest','verified')),
  ADD COLUMN IF NOT EXISTS is_scholar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 2) جداول المنشورات والتعليقات والإعجابات
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'عام',
  track TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- 3) جداول للمخطوطات والطبعات والحواشي (نماذج مبدئية)
CREATE TABLE IF NOT EXISTS manuscripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  book_id TEXT,
  title TEXT,
  image_url TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  book_id TEXT,
  title TEXT,
  image_url TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS footnotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL,
  hadith_number TEXT,
  category TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_footnotes_book ON footnotes(book_id);

-- 4) تأكد من وجود user_edits & follows (ملف سابق) — لا نحذف إن كانت موجودة
-- (تفاصيل موجودة في 01_add_follows_and_user_edits.sql)

-- 5) سياسة بسيطة لفحص الاتساق: نضيف بعض قيم الاختبار إذا لزم
-- ملاحظة: سياسات RLS مفصَّلة في ملف منفصل rls_policies.sql

-- نهاية الميلجريشن
