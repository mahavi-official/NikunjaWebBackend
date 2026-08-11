-- Create trigger function for Post.searchVector
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."excerpt", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."content", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_post_search_vector_trigger ON "Post";

-- Create trigger
CREATE TRIGGER update_post_search_vector_trigger
BEFORE INSERT OR UPDATE ON "Post"
FOR EACH ROW
EXECUTE FUNCTION update_post_search_vector();

-- Update all existing posts
UPDATE "Post" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("excerpt", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("content", '')), 'C');

-- Create GIN index on Post.searchVector
CREATE INDEX IF NOT EXISTS "idx_post_search_vector" ON "Post" USING GIN("searchVector");
