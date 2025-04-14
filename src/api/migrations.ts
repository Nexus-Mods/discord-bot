import { queryPromise } from './dbConnect';


async function migrationMoveConfigOptionsToJSON() {
    try {
        console.log('Migrating SubsribedItem settings to JSONB column');

        await queryPromise(
            `ALTER TABLE SubscribedItems
            ADD COLUMN IF NOT EXISTS config JSONB;`,
            [],
            'migrationMoveConfigOptionsToJSON - Add config column'
        );

        await queryPromise(
            `UPDATE SubscribedItems 
            SET config = CASE
                WHEN show_new IS NULL AND show_updates IS NULL AND nsfw IS NULL AND sfw IS NULL AND last_status IS NULL
                    THEN NULL -- Set config to NULL if all columns are NULL
                ELSE COALESCE(config, '{}') -- Ensure the config column is not NULL
                    || CASE WHEN show_new IS NOT NULL THEN jsonb_build_object('show_new', show_new) ELSE '{}'::jsonb END
                    || CASE WHEN show_updates IS NOT NULL THEN jsonb_build_object('show_updates', show_updates) ELSE '{}'::jsonb END
                    || CASE WHEN nsfw IS NOT NULL THEN jsonb_build_object('nsfw', nsfw) ELSE '{}'::jsonb END
                    || CASE WHEN sfw IS NOT NULL THEN jsonb_build_object('sfw', sfw) ELSE '{}'::jsonb END
                    || CASE WHEN last_status IS NOT NULL THEN jsonb_build_object('last_status', last_status) ELSE '{}'::jsonb END
            END`,
            [],
            'migrationMoveConfigOptionsToJSON'
        );

        // return queryPromise(
        //     `ALTER TABLE SubscribedItems
        //     DROP COLUMN IF EXISTS show_new,
        //     DROP COLUMN IF EXISTS show_updates,
        //     DROP COLUMN IF EXISTS nsfw,
        //     DROP COLUMN IF EXISTS sfw,
        //     DROP COLUMN IF EXISTS last_status;`,
        //     [],
        //     'migrationMoveConfigOptionsToJSON - Add delete old columns'
        // );
    }
    catch(err) {
        throw err
    }
}

async function migrationDeleteAPIkeyColumn(): Promise<void> {
    try {
        await queryPromise('ALTER TABLE users DROP COLUMN IF EXISTS apikey', []);
        console.log('Deleted API key column from users table');
    }
    catch (err) {
        throw err;
    }
}

export { migrationMoveConfigOptionsToJSON, migrationDeleteAPIkeyColumn };