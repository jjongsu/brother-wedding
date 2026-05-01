import { NextResponse } from 'next/server';
import { hashCommentPassword } from '@lib/comments/password';
import { checkRateLimit } from '@lib/rate-limit';
import { createSupabaseAdminClient } from '@lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
    try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('comments')
            .select('id, author, message, created_at')
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('댓글 목록 조회 오류:', error);
            return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ comments: (data ?? []).map(toPublicComment) });
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
        const { data, error } = await supabase
            .from('comments')
            .insert({
                author,
                message,
                password_hash: hashCommentPassword(password),
                is_hidden: false,
            })
            .select('id, author, message, created_at')
            .single();

        if (error) {
            console.error('댓글 작성 오류:', error);
            return NextResponse.json({ error: '댓글을 등록하지 못했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ comment: toPublicComment(data) }, { status: 201 });
    } catch (error) {
        console.error('댓글 작성 API 오류:', error);
        return NextResponse.json({ error: '댓글을 등록하지 못했습니다.' }, { status: 500 });
    }
}
