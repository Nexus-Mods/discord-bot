import express from 'express';
import { checkSharedSecret } from './auth';

function checkPermission(req: express.Request): boolean {
    return checkSharedSecret(req, 'CM_AUTHCODE');
}

const communityMap: express.RequestHandler = async (req, res) => {
    // Check permission
    if (!checkPermission(req)) {
        res.sendStatus(401);
        return;
    }

    
    // Check request type
    switch (req.method) {
        case 'GET': {
            // Fetch and return the map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'POST': {
            // Create new map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'DELETE': {
            // Delete map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'PUT': {
            // Completely overwrite the map data
            res.status(500).send('Not implemented');
            return;
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

const controversies: express.RequestHandler = async (req, res) => {
    // Check permission
    if (!checkPermission(req)) {
        res.sendStatus(401);
        return;
    }

    
    // Check request type
    switch (req.method) {
        case 'GET': {
            // Fetch and return the map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'POST': {
            // Create new map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'DELETE': {
            // Delete map data
            res.status(500).send('Not implemented');
            return;
        }
        case 'PUT': {
            // Completely overwrite the map data
            res.status(500).send('Not implemented');
            return;
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

export { communityMap, controversies };