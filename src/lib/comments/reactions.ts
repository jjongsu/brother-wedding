export const COMMENT_REACTION_TYPES = ['like', 'heart', 'clap', 'celebrate'] as const;

export type CommentReactionType = (typeof COMMENT_REACTION_TYPES)[number];

export type CommentReactionCounts = Record<CommentReactionType, number>;

export const createEmptyCommentReactionCounts = (): CommentReactionCounts => ({
    like: 0,
    heart: 0,
    clap: 0,
    celebrate: 0,
});

export const isCommentReactionType = (value: unknown): value is CommentReactionType => {
    return typeof value === 'string' && (COMMENT_REACTION_TYPES as readonly string[]).includes(value);
};

export const normalizeCommentReactionCounts = (
    counts?: Partial<Record<CommentReactionType, number>>,
): CommentReactionCounts => {
    const nextCounts = createEmptyCommentReactionCounts();

    for (const reactionType of COMMENT_REACTION_TYPES) {
        const value = counts?.[reactionType];

        if (typeof value === 'number' && Number.isFinite(value)) {
            nextCounts[reactionType] = Math.max(0, Math.floor(value));
        }
    }

    return nextCounts;
};

export const normalizeCommentReactionList = (values?: unknown[]): CommentReactionType[] => {
    if (!Array.isArray(values)) return [];

    return COMMENT_REACTION_TYPES.filter((reactionType) => values.includes(reactionType));
};
