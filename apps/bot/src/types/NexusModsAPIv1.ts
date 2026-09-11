export interface IChangelogs {
    [versionNumber: string]: string[];
}

export interface IUpdateEntry {
    mod_id: number;
    latest_file_update: number;
    latest_mod_activity: number;
}

type EndorsedStatus = 'Undecided' | 'Abstained' | 'Endorsed';
type ModStatus = 'under_moderation' | 'published' | 'not_published' | 'publish_with_game' | 'removed' | 'wastebinned' | 'hidden';
export interface IModInfo {
    mod_id: number;
    game_id: number;
    domain_name: string;
    category_id: number;
    contains_adult_content: boolean;
    name?: string;
    summary?: string;
    description?: string;
    version: string;
    author: string;
    user: IUser;
    uploaded_by: string;
    uploaded_users_profile_url: string;
    status: ModStatus;
    available: boolean;
    picture_url?: string;
    created_timestamp: number;
    created_time: string;
    updated_timestamp: number;
    updated_time: string;
    allow_rating: boolean;
    endorsement_count: number;
    mod_downloads: number;
    mod_unique_downloads: number;
    endorsement?: {
        endorse_status: EndorsedStatus;
        timestamp: number;
        version: number;
    };
}

interface IFileInfo {
    file_id: number;
    category_id: number;
    category_name: string;
    changelog_html: string;
    content_preview_link: string;
    name: string;
    description: string;
    version: string;
    size: number;
    size_kb: number;
    file_name: string;
    uploaded_timestamp: number;
    uploaded_time: string;
    mod_version: string;
    external_virus_scan_url: string;
    is_primary: boolean;
}
export interface IModFiles {
    file_updates: IFileUpdate[];
    files: IFileInfo[];
}
interface IFileUpdate {
    new_file_id: number;
    new_file_name: string;
    old_file_id: number;
    old_file_name: string;
    uploaded_time: string;
    uploaded_timestamp: number;
}

interface ICategory {
    category_id: number;
    name: string;
    parent_category: number | false;
}

export interface IGameListEntry {
    id: number;
    domain_name: string;
    name: string;
    forum_url: string;
    nexusmods_url: string;
    genre: string;
    mods: number;
    file_count: number;
    downloads: number;
    approved_date: number;
}
export interface IGameInfo extends IGameListEntry {
    categories: ICategory[];
}

interface IUser {
    member_id: number;
    member_group_id: number;
    name: string;
}
export interface IValidateKeyResponse {
    user_id: number;
    key: string;
    name: string;
    is_premium: boolean;
    is_supporter: boolean;
    email: string;
    profile_url: string;
}