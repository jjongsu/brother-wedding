import { NextResponse } from 'next/server';
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

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type ReactionRow = {
    comment_id: string;
    reaction_type: string;
};

const CLIENT_KEY_MIN_LENGTH = 8;
const CLIENT_KEY_MAX_LENGTH = 80;

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

const isValidClientKey = (value: string) => {
    return value.length >= CLIENT_KEY_MIN_LENGTH && value.length <= CLIENT_KEY_MAX_LENGTH;
};

const getReactionState = async (
    supabase: ReturnType<typeof createSupabaseAdminClient>,
    commentId: string,
    clientKey: string,
) => {
    const { data: reactionRows, error: reactionError } = await supabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .eq('comment_id', commentId);

    if (reactionError) {
        return {
            error: reactionError,
            reactions: createEmptyCommentReactionCounts(),
            myReactions: [] as CommentReactionType[],
        };
    }

    const reactions = ((reactionRows ?? []) as ReactionRow[]).reduce<CommentReactionCounts>((counts, row) => {
        if (isCommentReactionType(row.reaction_type)) {
            counts[row.reaction_type] += 1;
        }

        return counts;
    }, createEmptyCommentReactionCounts());

    const { data: myReactionRows, error: myReactionError } = await supabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .eq('comment_id', commentId)
        .eq('client_key', clientKey);

    if (myReactionError) {
        return {
            error: myReactionError,
            reactions,
            myReactions: [] as CommentReactionType[],
        };
    }

    const myReactions = ((myReactionRows ?? []) as ReactionRow[])
        .map((row) => row.reaction_type)
        .filter(isCommentReactionType);

    return {
        error: null,
        reactions,
        myReactions,
    };
};

export async function POST(request: Request, context: RouteContext) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'comment:reaction',
            limit: 30,
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

        const { id } = await context.params;
        const body = await parseJsonBody(request);
        const reaction = getTrimmedString(body?.reaction);
        const clientKey = getTrimmedString(body?.clientKey);

        if (!id) {
            return NextResponse.json({ error: '댓글 ID가 필요합니다.' }, { status: 400 });
        }

        if (!isCommentReactionType(reaction)) {
            return NextResponse.json({ error: '지원하지 않는 리액션입니다.' }, { status: 400 });
        }

        if (!isValidClientKey(clientKey)) {
            return NextResponse.json({ error: '리액션 식별값이 필요합니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: comment, error: commentError } = await supabase
            .from('comments')
            .select('id')
            .eq('id', id)
            .eq('is_hidden', false)
            .maybeSingle();

        if (commentError) {
            console.error('리액션 댓글 조회 오류:', commentError);
            return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
        }

        if (!comment) {
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 404 });
        }

        const { data: existingReaction, error: findError } = await supabase
            .from('comment_reactions')
            .select('id')
            .eq('comment_id', id)
            .eq('reaction_type', reaction)
            .eq('client_key', clientKey)
            .maybeSingle();

        if (findError) {
            console.error('리액션 조회 오류:', findError);
            return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
        }

        const active = !existingReaction;

        if (existingReaction) {
            const { error } = await supabase.from('comment_reactions').delete().eq('id', existingReaction.id);

            if (error) {
                console.error('리액션 삭제 오류:', error);
                return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
            }
        } else {
            const { error } = await supabase.from('comment_reactions').insert({
                comment_id: id,
                reaction_type: reaction,
                client_key: clientKey,
            });

            if (error) {
                console.error('리액션 등록 오류:', error);
                return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
            }
        }

        const reactionState = await getReactionState(supabase, id, clientKey);

        if (reactionState.error) {
            console.error('리액션 상태 조회 오류:', reactionState.error);
            return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({
            commentId: id,
            reaction,
            active,
            reactions: reactionState.reactions,
            myReactions: reactionState.myReactions,
        });
    } catch (error) {
        console.error('리액션 API 오류:', error);
        return NextResponse.json({ error: '리액션을 반영하지 못했습니다.' }, { status: 500 });
    }
}
