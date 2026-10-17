-- enforce_same_organization() names its parent tables without a schema. A session with another
-- search_path (e.g. a pg_dump import that sets it to '') would fail on every insert or update of the
-- tables it guards. Pin the function to the schema the tables live in.
ALTER FUNCTION enforce_same_organization() SET search_path = public;
