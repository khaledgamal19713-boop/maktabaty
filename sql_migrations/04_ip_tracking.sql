-- Enhanced IP Tracking for Researchers

-- 1. Add author/researcher attribution to the canonical texts table
ALTER TABLE texts
ADD COLUMN IF NOT EXISTS researcher_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Ensure footnotes also track the approved researcher
ALTER TABLE footnotes
ADD COLUMN IF NOT EXISTS approved_researcher_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Policy to allow researchers to see their own pending additions in a "work in progress" mode
CREATE POLICY "Researchers can view their pending contributions"
ON texts FOR SELECT
USING (researcher_id = auth.uid());
