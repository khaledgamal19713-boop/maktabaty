-- 1. Knowledge Entities Table
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- e.g., 'Book', 'Hadith', 'Narrator', 'Manuscript'
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- draft, review, verified, approved, published
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Knowledge Relationships Table
CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- e.g., 'IsTeacherOf', 'NarratedFrom', 'Explains'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Knowledge Revisions Table (Git-like model)
CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  changeset JSONB NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'verification', 'approval', 'publication')),
  parent_revision_id UUID REFERENCES knowledge_revisions(id),
  evidence_set JSONB DEFAULT '[]',
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  operation TEXT NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'
  affected_object_id UUID,
  previous_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 5. Update Profiles with all roles from TPS
-- First, drop existing constraint if it exists (might need to check name or just try to replace)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'Visitor', 'Reader', 'Researcher', 'Contributor', 'Verifier',
  'Reviewer', 'Editor', 'Senior Editor', 'Scientific Supervisor',
  'Scientific Board', 'System Administrator'
));

-- 6. Enable RLS
ALTER TABLE knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (Basic defaults, to be refined per layer)
CREATE POLICY "Public read for published entities" ON knowledge_entities
FOR SELECT USING (status = 'published' OR auth.uid() IS NOT NULL);

CREATE POLICY "Public read for relationships" ON knowledge_relationships
FOR SELECT USING (true);

CREATE POLICY "Revision access" ON knowledge_revisions
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Audit logs access" ON audit_logs
FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('System Administrator', 'Scientific Board')));
