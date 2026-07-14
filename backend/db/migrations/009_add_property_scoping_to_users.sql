-- Adds nullable property-level scoping to users.
-- NULL = company-wide access (current behavior, unchanged for all existing users)
-- <uuid> = scoped to that single property only
ALTER TABLE users
  ADD COLUMN property_id UUID NULL REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX idx_users_property_id ON users(property_id);
