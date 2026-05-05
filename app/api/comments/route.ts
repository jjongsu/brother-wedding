import { NextResponse } from 'next/server';
import { hashCommentPassword } from '@lib/comments/password';
import {
    createEmptyCommentReactionCounts,
    isCommentReactionType,
    type CommentReactionCounts,
    type CommentReactionType,
} from '@lib/comments/reactions';
import { checkRateLimit } from '@lib/rate-limit';
import { createSupabaseAdminClient } from '@lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CommentRow = {
    id: string;
    parent_id: string | null;
    author: string;
    message: string;
    created_at: string;
};

type ReactionRow = {
    comment_id: string;
    reaction_type: string;
};

type PublicComment = {
    id: string;
    parentId: string | null;
    author: string;
    message: string;
    createdAt: string;
    reactions: CommentReactionCounts;
    myReactions: CommentReactionType[];
    replies: PublicComment[];
};

const CLIENT_KEY_MIN_LENGTH = 8;
const CLIENT_KEY_MAX_LENGTH = 80;

const isValidClientKey = (value: string) => {
    return value.length >= CLIENT_KEY_MIN_LENGTH && value.length <= CLIENT_KEY_MAX_LENGTH;
};

const toPublicComment = (
    comment: CommentRow,
    reactions = createEmptyCommentReactionCounts(),
    myReactions: CommentReactionType[] = [],
): PublicComment => ({
    id: comment.id,
    parentId: comment.parent_id,
    author: comment.author,
    message: comment.message,
    createdAt: comment.created_at,
    reactions,
    myReactions,
    replies: [],
});

const getTrimmedString = (value: unknown) => {
    return typeof value === 'string' ? value.trim() : '';
};

const parseJsonBody = async (request: Request) => {
    try {
        return await request.json();
    } catch {
        return null;
    }
};

const getClientKey = (request: Request) => {
    const url = new URL(request.url);
    const clientKey = getTrimmedString(url.searchParams.get('clientKey'));

    return isValidClientKey(clientKey) ? clientKey : '';
};

const getDateValue = (value: string) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getReactionCountsByComment = (rows: ReactionRow[]) => {
    const countsByComment = new Map<string, CommentReactionCounts>();

    for (const row of rows) {
        if (!isCommentReactionType(row.reaction_type)) continue;

        const counts = countsByComment.get(row.comment_id) ?? createEmptyCommentReactionCounts();
        counts[row.reaction_type] += 1;
        countsByComment.set(row.comment_id, counts);
    }

    return countsByComment;
};

const getMyReactionsByComment = (rows: ReactionRow[]) => {
    const reactionsByComment = new Map<string, Set<CommentReactionType>>();

    for (const row of rows) {
        if (!isCommentReactionType(row.reaction_type)) continue;

        const reactions = reactionsByComment.get(row.comment_id) ?? new Set<CommentReactionType>();
        reactions.add(row.reaction_type);
        reactionsByComment.set(row.comment_id, reactions);
    }

    return new Map(
        Array.from(reactionsByComment.entries()).map(([commentId, reactions]) => [commentId, Array.from(reactions)]),
    );
};

const buildCommentTree = (comments: PublicComment[]) => {
    const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
    const rootComments: PublicComment[] = [];

    for (const comment of comments) {
        if (!comment.parentId) {
            rootComments.push(comment);
            continue;
        }

        const parentComment = commentsById.get(comment.parentId);

        if (parentComment) {
            parentComment.replies.push(comment);
        }
    }

    rootComments.sort((left, right) => getDateValue(right.createdAt) - getDateValue(left.createdAt));

    for (const comment of comments) {
        comment.replies.sort((left, right) => getDateValue(left.createdAt) - getDateValue(right.createdAt));
    }

    return rootComments;
};

export async function GET(request: Request) {
    try {
        const clientKey = getClientKey(request);
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('comments')
            .select('id, parent_id, author, message, created_at')
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('댓글 목록 조회 오류:', error);
            return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
        }

        const comments = (data ?? []) as CommentRow[];
        const commentIds = comments.map((comment) => comment.id);
        let reactionRows: ReactionRow[] = [];
        let myReactionRows: ReactionRow[] = [];

        if (commentIds.length > 0) {
            const { data: reactions, error: reactionError } = await supabase
                .from('comment_reactions')
                .select('comment_id, reaction_type')
                .in('comment_id', commentIds);

            if (reactionError) {
                console.error('댓글 리액션 조회 오류:', reactionError);
                return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
            }

            reactionRows = (reactions ?? []) as ReactionRow[];

            if (clientKey) {
                const { data: myReactions, error: myReactionError } = await supabase
                    .from('comment_reactions')
                    .select('comment_id, reaction_type')
                    .eq('client_key', clientKey)
                    .in('comment_id', commentIds);

                if (myReactionError) {
                    console.error('내 댓글 리액션 조회 오류:', myReactionError);
                    return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
                }

                myReactionRows = (myReactions ?? []) as ReactionRow[];
            }
        }

        const countsByComment = getReactionCountsByComment(reactionRows);
        const myReactionsByComment = getMyReactionsByComment(myReactionRows);
        const publicComments = comments.map((comment) =>
            toPublicComment(
                comment,
                countsByComment.get(comment.id) ?? createEmptyCommentReactionCounts(),
                myReactionsByComment.get(comment.id) ?? [],
            ),
        );

        return NextResponse.json({ comments: buildCommentTree(publicComments) });
    } catch (error) {
        console.error('댓글 목록 API 오류:', error);
        return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'comment:create',
            limit: 5,
            windowMs: 60 * 1000,
        });

        if (rateLimit.limited) {
            return NextResponse.json(
                { error: '잠시 후 다시 시도해주세요.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const body = await parseJsonBody(request);
        const author = getTrimmedString(body?.author);
        const message = getTrimmedString(body?.message);
        const password = getTrimmedString(body?.password);
        const parentId = getTrimmedString(body?.parentId);

        if (author.length < 1 || author.length > 40) {
            return NextResponse.json({ error: '이름은 1자 이상 40자 이하로 입력해주세요.' }, { status: 400 });
        }

        if (message.length < 1 || message.length > 500) {
            return NextResponse.json({ error: '메시지는 1자 이상 500자 이하로 입력해주세요.' }, { status: 400 });
        }

        if (password.length < 4 || password.length > 40) {
            return NextResponse.json({ error: '비밀번호는 4자 이상 40자 이하로 입력해주세요.' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        if (parentId) {
            const { data: parentComment, error: parentError } = await supabase
                .from('comments')
                .select('id, parent_id')
                .eq('id', parentId)
                .eq('is_hidden', false)
                .maybeSingle();

            if (parentError) {
                console.error('답글 대상 댓글 조회 오류:', parentError);
                return NextResponse.json({ error: '답글을 등록하지 못했습니다.' }, { status: 500 });
            }

            if (!parentComment) {
                return NextResponse.json({ error: '답글을 남길 댓글을 찾지 못했습니다.' }, { status: 404 });
            }

            if ((parentComment as { parent_id: string | null }).parent_id) {
                return NextResponse.json({ error: '답글에는 다시 답글을 남길 수 없습니다.' }, { status: 400 });
            }
        }

        const { data, error } = await supabase
            .from('comments')
            .insert({
                parent_id: parentId || null,
                author,
                message,
                password_hash: hashCommentPassword(password),
                is_hidden: false,
            })
            .select('id, parent_id, author, message, created_at')
            .single();

        if (error) {
            console.error('댓글 작성 오류:', error);
            return NextResponse.json({ error: '댓글을 등록하지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ comment: toPublicComment(data as CommentRow) }, { status: 201 });
    } catch (error) {
        console.error('댓글 작성 API 오류:', error);
        return NextResponse.json({ error: '댓글을 등록하지 못했습니다.' }, { status: 500 });
    }
}
