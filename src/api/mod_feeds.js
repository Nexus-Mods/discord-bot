const { query } = require('./dbConnect.js');

const getAllModFeeds = () => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds', [], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const getModFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows[0]);
        });
    });
}

const getModFeedsForServer = (serverId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds WHERE guild = $1', [serverId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const createModFeed = (newFeed) => {
    newFeed.created = new Date();
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO mod_feeds (channel, guild, owner, domain, mod_id, title, last_status, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [newFeed.channel, newFeed.guild, newFeed.owner, newFeed.domain, newFeed.mod_id, newFeed.title, newFeed.last_status, new Date(0), newFeed.created], 
        (error, results) => {
            if (error) {
                //throw error;
                console.log(error);
                if (error.code === "23505") return reject(`Error ${error.code} - The field ${error.constraint} is not unique.`);
            };
            // GET THE ID FOR THIS FEED;
            query('SELECT _id FROM mod_feeds WHERE created = $1 AND owner = $2 AND mod_id = $3', [newFeed.created, newFeed.owner, newFeed.mod_id],
            (error, indexResult) => {
                if (error) return console.log(err);
                return resolve(indexResult.rows[0]._id);
            });
        })
    });
}

const updateModFeed = (feedId, newData) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE mod_feeds SET ${key} = $1 WHERE _id = $2`, [newData[key], feedId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

const deleteModFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM mod_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

module.exports = { getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed };

/*
STRUCTURE OF A MOD FEED
    {
        _id: unique ID,
        channel: channel ID,
        guild: guild ID,
        owner: owner Discord ID,
        domain: gameDomain,
        mod_id: mod ID,
        title: mod name,
        show_files: show file updates,
        show_other: show other updates,
        last_timestamp: the timestamp of the last change,
        last_status: the mod state at last check,
        message: message to go with embed,
        created: creation timestamp
    }

SQL for the table

CREATE TABLE public.mod_feeds
(
    _id integer NOT NULL DEFAULT nextval('mod_feeds__id_seq'::regclass),
    channel character varying COLLATE pg_catalog."default" NOT NULL,
    guild character varying COLLATE pg_catalog."default",
    owner character varying COLLATE pg_catalog."default",
    domain character varying COLLATE pg_catalog."default" NOT NULL,
    mod_id integer NOT NULL,
    title character varying COLLATE pg_catalog."default",
    show_files boolean NOT NULL DEFAULT true,
    show_other boolean NOT NULL DEFAULT false,
    last_timestamp timestamp with time zone NOT NULL,
    last_status character varying COLLATE pg_catalog."default" NOT NULL,
    message character varying COLLATE pg_catalog."default",
    created timestamp with time zone NOT NULL,
    CONSTRAINT mod_feeds_pkey PRIMARY KEY (_id)
)

TABLESPACE pg_default;

ALTER TABLE public.mod_feeds
    OWNER to postgres;

GRANT ALL ON TABLE public.mod_feeds TO me;

GRANT ALL ON TABLE public.mod_feeds TO postgres;

*/