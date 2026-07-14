-- Migration to define the Maarif system schema (Interactive Illness Linking & Knowledge Graph)

-- 1. Maarif Nodes Table (Tree structure for أجناس العلة)
CREATE TABLE IF NOT EXISTS maarif_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_id TEXT REFERENCES maarif_nodes(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Maarif Hadiths Table (Illness Hadiths from Ibn Abi Hatim & Al-Daraqutni)
CREATE TABLE IF NOT EXISTS maarif_hadiths (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book TEXT NOT NULL CHECK (book IN ('علل ابن أبي حاتم', 'علل الدارقطني')),
  issue TEXT NOT NULL,
  number TEXT,
  text TEXT NOT NULL,
  companion TEXT,
  narrator TEXT,
  reasoning_text TEXT,
  part TEXT,
  page TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Maarif Links Table (Interactive Links between Hadiths and Nodes)
CREATE TABLE IF NOT EXISTS maarif_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES maarif_nodes(id) ON DELETE CASCADE,
  hadith_id BIGINT NOT NULL REFERENCES maarif_hadiths(id) ON DELETE CASCADE,
  confidence NUMERIC(5,2) DEFAULT 100.00,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(node_id, hadith_id)
);

-- 4. Maarif Logs Table (Revision log / Activity stream)
CREATE TABLE IF NOT EXISTS maarif_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action_type TEXT NOT NULL, -- 'link', 'unlink', 'create_hadith', 'create_node'
  hadith_id BIGINT REFERENCES maarif_hadiths(id) ON DELETE CASCADE,
  node_id TEXT REFERENCES maarif_nodes(id) ON DELETE CASCADE,
  details TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE maarif_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maarif_hadiths ENABLE ROW LEVEL SECURITY;
ALTER TABLE maarif_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE maarif_logs ENABLE ROW LEVEL SECURITY;

-- Set up basic policies (Read for all, write/link for authenticated profiles)
CREATE POLICY "Public Read Maarif Nodes" ON maarif_nodes FOR SELECT USING (true);
CREATE POLICY "Admin Write Maarif Nodes" ON maarif_nodes FOR ALL USING (true); -- Simplified for mock integration

CREATE POLICY "Public Read Maarif Hadiths" ON maarif_hadiths FOR SELECT USING (true);
CREATE POLICY "Auth Insert Maarif Hadiths" ON maarif_hadiths FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public Read Maarif Links" ON maarif_links FOR SELECT USING (true);
CREATE POLICY "Auth Link Maarif Links" ON maarif_links FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public Read Maarif Logs" ON maarif_logs FOR SELECT USING (true);
CREATE POLICY "Auth Insert Maarif Logs" ON maarif_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed Data: Maarif Nodes
INSERT INTO maarif_nodes (id, title, parent_id, description) VALUES
('root', 'شجرة أجناس علل الحديث', NULL, 'الجنس الرئيس الجامع لأجناس العلة المستخرجة من كتاب أجناس العلة للدارقطني'),
('ikhtilaf_rawi', 'اختلاف الرواة', 'root', 'الاختلاف الواقع في الإسناد أو المتن بين الثقات أو الرواة'),
('wasl_irsal', 'وصل وإرسال', 'ikhtilaf_rawi', 'الاختلاف بين وصل الحديث موصولاً مسنداً وبين إرساله منقطعاً'),
('raf_waqf', 'رفع ووقف', 'ikhtilaf_rawi', 'الاختلاف بين رفع الحديث إلى النبي صلى الله عليه وسلم وبين وقفه على الصحابي'),
('ziyadat_rawi', 'زيادة راو', 'ikhtilaf_rawi', 'انفراد راو بزيادة كلمة أو جملة في المتن، أو زيادة راو في السند لم يذكره غيره'),
('isqat_rawi', 'إسقاط راو', 'ikhtilaf_rawi', 'سقوط راو من السند سواء كان عمداً أو وهماً من الراوي'),
('ikhtilaf_ala_shaikh', 'اختلاف على شيخ', 'ikhtilaf_rawi', 'يرويه الرواة عن الشيخ الواحد على وجوه مختلفة ومتعارضة'),
('وجه_اول', 'الوجه الأول', 'ikhtilaf_ala_shaikh', 'الوجه الأول المروي عن الشيخ'),
('وجه_ثاني', 'الوجه الثاني', 'ikhtilaf_ala_shaikh', 'الوجه الثاني المروي عن الشيخ المخالف للأول'),
('tashif_tahrif', 'التصحيف والتحريف', 'root', 'تغيير الحروف بالمرادفة أو بالتشابه في الشكل والنقط'),
('wahm_rawi', 'وهم راو', 'root', 'وقوع الراوي في الخطأ والوهم في السند أو المتن دون قصد المخالفة'),
('idraj', 'الإدراج', 'root', 'إدخال كلام في متن الحديث أو راو في السند ليس منه'),
('qalb', 'القلب', 'root', 'تبديل لفظ بآخر أو راو بآخر في الإسناد أو المتن')
ON CONFLICT (id) DO NOTHING;

-- Seed Data: Maarif Hadiths
INSERT INTO maarif_hadiths (id, book, issue, number, text, companion, narrator, reasoning_text, part, page) OVERRIDING SYSTEM VALUE VALUES
(1, 'علل ابن أبي حاتم', 'مسألة 215', '215', 'سألت أبي عن حديث رواه سفيان الثوري عن الأعمش عن أبي صالح عن أبي هريرة مرفوعا: "إذا أقيمت الصلاة فلا تأتوها تسعون". ورواه شعبة عن الأعمش موقوفا.', 'أبو هريرة', 'الأعمش', 'أخطأ الثوري في رفعه، والصواب فيه الوقف كما رواه شعبة.', '1', '124'),
(2, 'علل الدارقطني', 'مسألة 346', '346', 'وسئل الدارقطني عن حديث سعيد بن المسيب عن أبي هريرة عن النبي صلى الله عليه وسلم: "لا يحل لامرأة تسافر مسيرة يوم وليلة إلا مع ذي محرم". فقال: يرويه مالك عن نافع موصولا، ورواه غيره مرسلا، والصواب المرسل.', 'أبو هريرة', 'نافع', 'خالف مالك في وصله، والصواب فيه المرسل عن غيره.', '2', '88'),
(3, 'علل ابن أبي حاتم', 'مسألة 991', '991', 'سمعت أبي وذكر حديثا رواه حماد بن سلمة عن ثابت عن أنس مرفوعا في فضل السواك. فقال أبي: أخطأ حماد، وإنما هو من قول ثابت موقوف عليه، وزاد فيه حماد رفعه.', 'أنس بن مالك', 'ثابت البناني', 'وزاد فيه حماد رفعه وهو وهم، والصواب أنه موقوف على ثابت.', '4', '56'),
(4, 'علل الدارقطني', 'مسألة 1510', '1510', 'وسئل عن حديث أبي إسحاق عن البراء: "كان النبي صلى الله عليه وسلم يتوضأ لكل صلاة". فقال: اختلف فيه على أبي إسحاق، فرواه شعبة موصولا، ورواه سفيان منقطعا بإسقاط راو بينهما وهو أبو بردة.', 'البراء بن عازب', 'أبو إسحاق السبيعي', 'اختلف فيه، ورواه سفيان بإسقاط راو بين أبي إسحاق والبراء وهو الصواب.', '6', '210')
ON CONFLICT (id) DO NOTHING;

-- Seed Data: Maarif Links (Initial suggested connections)
INSERT INTO maarif_links (id, node_id, hadith_id, confidence, created_by) OVERRIDING SYSTEM VALUE VALUES
(1, 'raf_waqf', 1, 94.00, NULL),
(2, 'wasl_irsal', 2, 86.00, NULL),
(3, 'ziyadat_rawi', 3, 43.00, NULL),
(4, 'isqat_rawi', 4, 75.00, NULL)
ON CONFLICT (id) DO NOTHING;
