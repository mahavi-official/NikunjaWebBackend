-- Create trigger function for Research.searchVector
CREATE OR REPLACE FUNCTION update_research_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."abstract", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."extractedText", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_research_search_vector_trigger ON "Research";

-- Create trigger
CREATE TRIGGER update_research_search_vector_trigger
BEFORE INSERT OR UPDATE ON "Research"
FOR EACH ROW
EXECUTE FUNCTION update_research_search_vector();

-- Update all existing research
UPDATE "Research" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("abstract", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("extractedText", '')), 'C');

-- Create GIN index on Research.searchVector
CREATE INDEX IF NOT EXISTS "idx_research_search_vector" ON "Research" USING GIN("searchVector");
