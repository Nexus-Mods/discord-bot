export interface ForumTopic {
    id: number;
    title: string;
    forum: {
        id: number;
        name: string;
        path: string;
        type: string;
        topics: number;
        url: string;
        parentId: number;
        permissions: Record<string, any>;
        club: number;
    };
    posts: number;
    views: number;
    prefix: string | null;
    tags: string[];
    firstPost: ForumPost;
    lastPost: ForumPost;
    bestAnswer: any | null;
    locked: boolean;
    hidden: boolean;
    pinned: boolean;
    featured: boolean;
    archived: boolean;
    poll: any | null;
    url: string;
    rating: number;
    is_future_entry: number;
    publish_date: string;
}

export interface ForumPost {
    id: number;
    item_id: number;
    author: ForumAuthor;
    date: string;
    content: string;
    hidden: boolean;
    url: string;
    reactions: any[];
}

interface ForumAuthor {
    id: number;
    name: string;
    title: string | null;
    timeZone: string;
    formattedName: string;
    primaryGroup: Record<string, any>;
    secondaryGroups: Record<string, any>[];
    email: string;
    joined: string;
    registrationIpAddress: string;
    warningPoints: number;
    reputationPoints: number;
    photoUrl: string;
    photoUrlIsDefault: boolean;
    coverPhotoUrl: string;
    profileUrl: string;
    validating: boolean;
    posts: number;
    lastActivity: string;
    lastVisit: string;
    lastPost: string;
    birthday: string | null;
    profileViews: number;
    customFields: Record<string, any>;
    rank: Record<string, any>;
    achievements_points: number;
    allowAdminEmails: boolean;
    completed: boolean;
}