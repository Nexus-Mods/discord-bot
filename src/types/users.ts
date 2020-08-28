interface NexusUser {
    d_id: string;
    id: number;
    name: string;
    avatar_url?: string;
    apikey: string;
    supporter: boolean;
    premium: boolean;
    modauthor?: boolean;
    lastupdate?: Date;
    servers?: NexusUserServerLink[];
}

interface NexusUserServerLink {
    user_id: number;
    server_id: string;
}

interface NexusLinkedMod {
    domain: string;
    mod_id: number;
    name: string;
    game: string;
    unique_downloads: number;
    total_downloads: number;
    path: string;
    owner: number;
}

export { NexusUser, NexusUserServerLink, NexusLinkedMod };