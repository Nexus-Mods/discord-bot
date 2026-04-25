import { Rule } from '../types/AutomodTypes';
import { queryAutoMod } from '../api/dbConnect';
import express from 'express';

function checkPermission(req: express.Request): boolean {
    const authCode = process.env.CM_AUTHCODE;
    return (authCode ? req.headers.authorization !== authCode : true);
}

const automodRules: express.RequestHandler = async (req, res) => {
    // Check permission
    if (!checkPermission(req)) {
        res.sendStatus(401);
        return;
    }

    
    // Check request type
    switch (req.method) {
        case 'GET': {
            // Fetch and return the map data
            try {
                const { limit, offset } = req.query;
                const qLimit = limit ? Number(limit) : undefined;
                const qOffset = offset ? Number(offset) : undefined;
                const rules = await getAutomodRules(qLimit, qOffset);
                res.status(200).send(JSON.stringify(rules));
                return;
            }
            catch(err: unknown) {
                res.status(500).send(`Unexpected error: ${(err as Error).message}`);
                return;
            }
        }
        case 'POST': {
            const body = req.body;
            try {
                const newRule = JSON.parse(body);
                console.log("Incoming rule", newRule);
                const addedRule = await createNewRule(newRule);
                console.log("Saved rule", addedRule);
                res.status(201).send(JSON.stringify(addedRule));
                return;
            }
            catch(err) {
                res.status(500).send(`Unexpected error: ${(err as Error).message}`);
                return;
            }
        }
        case 'DELETE': {
            // Delete rule
            const { id } = req.query;
            if (!id || isNaN(parseInt(id as string))) {
                res.status(400)
                return;
            }
            try {
                await deleteRule(Number(id));
                res.status(200)
                return;
            }
            catch(err: unknown) {
                res.status(500).send(`Unexpected error: ${(err as Error).message}`);
                return;
            }
        }
        case 'PUT': {
            // Completely overwrite the rule
            const body = req.body;
            try {
                const newRule = JSON.parse(body);
                if (!newRule.id) {
                    res.status(400)
                    return;
                }
                const addedRule = await updateRule(newRule);
                res.status(200).send(JSON.stringify(addedRule));
                return;
            }
            catch(err) {
                res.status(500).send(`Unexpected error: ${(err as Error).message}`);
                return;
            }
        }
        case 'PATCH': {
            // Update map data
            res.status(500).send('Not implemented');
            return;
        }
        default: {
            res.status(500).send('Unrecognised HTTP Method')
            return;
        }
    }
}

async function getAutomodRules(limit?: number, offset?: number): Promise<Rule[]> {
    let query = "SELECT * FROM rules"
    if (limit && !isNaN(limit)) query = `${query} LIMIT ${limit}`;
    if (offset && !isNaN(offset)) query = `${query} OFFSET ${offset}`;
    const rules = await queryAutoMod<Rule>(query);
    return rules.rows;
}

async function createNewRule(rule: Omit<Rule, 'id'>): Promise<Rule> {
    const query = 
        `INSERT INTO rules (targets, pattern_type, pattern, points, text_fields, description, game_domain, exclude_mods, exclude_users) `+
        `VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`
    const variables = [
        rule.targets,
        rule.pattern_type,
        rule.pattern,
        rule.points,
        rule.text_fields,
        rule.description,
        rule.game_domain ?? null,
        rule.exclude_mods ?? null,
        rule.exclude_users ?? null
    ];

    const newRule = await queryAutoMod<Rule>(query, variables);
    if (!newRule.rows || newRule.rows.length === 0) {
        throw new Error('Failed to insert rule: No rows returned from database');
    }
    return newRule.rows[0];
}

async function updateRule(rule: Rule): Promise<Rule> {
    const query = 
        `UPDATE rules SET targets=$1, pattern_type=$2, pattern=$3, points=$4, text_fields=$5, description=$6, game_domain=$7, exclude_mods=$8, exclude_users=$9 `+
        `WHERE id=$10 RETURNING *;`
    const variables = [
        rule.targets,
        rule.pattern_type,
        rule.pattern,
        rule.points,
        rule.text_fields,
        rule.description,
        rule.game_domain ?? null,
        rule.exclude_mods ?? null,
        rule.exclude_users ?? null,
        rule.id
    ];

    const newRule = await queryAutoMod<Rule>(query, variables);
    return newRule.rows[0];
}

async function deleteRule(id: number): Promise<void> {
    const result = await queryAutoMod('DELETE FROM rules WHERE id=$1', [id], 'DeleteAutomodRule')
}

export { automodRules };