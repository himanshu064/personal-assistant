/** Cache tag for a user's Inbox (suggestions and Gmail connection). No server-only imports, so any module can use it. */
export const inboxTag = (userId: string) => `user:${userId}:inbox`;
