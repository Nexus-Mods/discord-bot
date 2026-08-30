-- Drop the orphaned sequence left behind by a mod_feeds table that no longer exists.
--
-- Not a plain DROP SEQUENCE. The evidence that it is orphaned is a drizzle-kit push
-- diff, which is good evidence and not proof, and the failure mode if it is wrong is
-- bad in both available directions: CASCADE would silently strip a column default and
-- break every insert into that table, while a bare DROP would abort the migration and
-- refuse to start the bot.
--
-- So it asks Postgres instead of asserting. DROP SEQUENCE without CASCADE raises
-- dependent_objects_still_exist if anything - a column default, an identity column,
-- an OWNED BY link - still needs it. Catching that turns "I believe this is unused"
-- into "this is dropped only if the database agrees", and leaves it in place with a
-- notice otherwise.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'mod_feeds__id_seq'
          AND relkind = 'S'
          AND relnamespace = 'public'::regnamespace
    ) THEN
        BEGIN
            EXECUTE 'DROP SEQUENCE public."mod_feeds__id_seq"';
            RAISE NOTICE 'Dropped orphaned sequence mod_feeds__id_seq.';
        EXCEPTION WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'mod_feeds__id_seq is still required by another object; left in place.';
        END;
    ELSE
        RAISE NOTICE 'mod_feeds__id_seq is not present; nothing to do.';
    END IF;
END $$;
