import { queryPromise } from './dbConnect';

type ConditionType = 'modDownloads' | 'modsPublished';
type Operator = 'AND' | 'OR';

export interface IConditionForRole {
    id: number;
    server_id: string;
    role_id: string;
    type: ConditionType;
    game: string;
    min: number;
    op: Operator;
}

async function getConditionsForRole(serverId: string, roleId: string): Promise<IConditionForRole[]> {
   try {
        const data = await queryPromise(
            'SELECT id, server_id, role_id, type, game, min, op FROM server_role_conditions WHERE server_id=$1 AND role_id=$2 ORDER BY id', 
            [serverId, roleId]
        );
        return data.rows as IConditionForRole[];
    }
    catch(error) {
        throw new Error(`Could not get role conditions from database. ${(error as Error).message}`);
    }
} 

async function addConditionForRole(serverId: string, roleId: string, type: ConditionType, game: string, min: number, op: Operator = 'AND'): Promise<IConditionForRole> {
    try {
        const data = await queryPromise(
            'INSERT INTO server_role_conditions (server_id, role_id, type, game, min, op) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', 
            [serverId, roleId, type, game, min, op]
        );
        return data.rows[0] as IConditionForRole;
    }
    catch(error) {
        throw new Error(`Could not add role conditions from database. ${(error as Error).message}`);
    }
}

async function deleteConditionForRole(id: number): Promise<void> {
    try {
        await queryPromise(
            'DELETE FROM server_role_conditions WHERE id=$1', 
            [id]
        );
    }
    catch(error) {
        throw new Error(`Could not delete role conditions from database. ${(error as Error).message}`);
    }
}


export { getConditionsForRole, addConditionForRole, deleteConditionForRole };