-- 1. Knowledge Entities Table
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Knowledge Relationships Table
CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Knowledge Revisions Table
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
  operation TEXT NOT NULL,
  affected_object_id UUID,
  previous_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 5. Enhanced Profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'guest',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

-- Roles
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
