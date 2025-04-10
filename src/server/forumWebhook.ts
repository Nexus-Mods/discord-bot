import { Logger } from '../api/util';
import express from 'express';

export default async function forumWebhook(req: express.Request, res: express.Response, logger: Logger): Promise<void>{
    logger.info('Received forum webhook', {event: req.body.event, data: req.body.data});
    res.status(200).send('OK');
}