-- Read-only deployment evidence. No migration logs or application record contents.
SELECT COALESCE(json_agg(json_build_object(
  'migration_name', migration_name,
  'checksum', checksum,
  'finished', finished_at IS NOT NULL,
  'rolled_back', rolled_back_at IS NOT NULL
) ORDER BY migration_name), '[]'::json)
FROM "_prisma_migrations";
