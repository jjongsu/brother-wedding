import { NextResponse } from 'next/server';
import { verifyCommentPassword } from '@lib/comments/password';
import { checkRateLimit } from '@lib/rate-limit';
import { createSupabaseAdminClient } from '@lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type PrivateCommentRow = {
    id: string;
    password_hash: string | null;
};

type CommentRow = {
    id: string;
    author: string;
    message: string;
    created_at: string;
};

const toPublicComment = (comment: CommentRow) => ({
    id: comment.id,
    author: comment.author,
    message: comment.message,
    createdAt: comment.created_at,
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

const isAuthorized = (comment: PrivateCommentRow, password: string) => {
    return Boolean(password && verifyCommentPassword(password, comment.password_hash));
};

const findCommentForAuth = async (id: string) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('comments')
        .select('id, password_hash')
        .eq('id', id)
        .eq('is_hidden', false)
        .maybeSingle();

    return { supabase, data, error };
};

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'comment:update',
            limit: 10,
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
        const message = getTrimmedString(body?.message);
        const password = getTrimmedString(body?.password);

        if (!id) {
            return NextResponse.json({ error: '댓글 ID가 필요합니다.' }, { status: 400 });
        }

        if (message.length < 1 || message.length > 500) {
            return NextResponse.json({ error: '메시지는 1자 이상 500자 이하로 입력해주세요.' }, { status: 400 });
        }

        const { supabase, data: comment, error: findError } = await findCommentForAuth(id);

        if (findError) {
            console.error('댓글 수정 조회 오류:', findError);
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 500 });
        }

        if (!comment) {
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 404 });
        }

        if (!isAuthorized(comment, password)) {
            return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                message,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id, author, message, created_at')
            .single();

        if (error) {
            console.error('댓글 수정 오류:', error);
            return NextResponse.json({ error: '댓글을 수정하지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ comment: toPublicComment(data) });
    } catch (error) {
        console.error('댓글 수정 API 오류:', error);
        return NextResponse.json({ error: '댓글을 수정하지 못했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'comment:delete',
            limit: 10,
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
        const password = getTrimmedString(body?.password);

        if (!id) {
            return NextResponse.json({ error: '댓글 ID가 필요합니다.' }, { status: 400 });
        }

        const { supabase, data: comment, error: findError } = await findCommentForAuth(id);

        if (findError) {
            console.error('댓글 삭제 조회 오류:', findError);
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 500 });
        }

        if (!comment) {
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 404 });
        }

        if (!isAuthorized(comment, password)) {
            return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 401 });
        }

        const { error } = await supabase
            .from('comments')
            .update({
                is_hidden: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) {
            console.error('댓글 삭제 오류:', error);
            return NextResponse.json({ error: '댓글을 삭제하지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('댓글 삭제 API 오류:', error);
        return NextResponse.json({ error: '댓글을 삭제하지 못했습니다.' }, { status: 500 });
    }
}
