import { NextResponse } from 'next/server';
import { getAdminSession } from '@lib/admin/auth';
import { createSupabaseAdminClient } from '@lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type AdminCommentRow = {
    id: string;
    author: string;
    message: string;
    is_hidden: boolean;
    created_at: string;
    updated_at: string;
};

const toManagedComment = (comment: AdminCommentRow) => ({
    id: comment.id,
    author: comment.author,
    message: comment.message,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    status: comment.is_hidden ? 'hidden' : 'visible',
});

const parseJsonBody = async (request: Request) => {
    try {
        return await request.json();
    } catch {
        return null;
    }
};

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const admin = await getAdminSession(request);

        if (!admin) {
            return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await parseJsonBody(request);
        const isHidden = body?.isHidden;

        if (!id) {
            return NextResponse.json({ error: '댓글 ID가 필요합니다.' }, { status: 400 });
        }

        if (typeof isHidden !== 'boolean') {
            return NextResponse.json({ error: '변경할 노출 상태가 필요합니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('comments')
            .update({
                is_hidden: isHidden,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id, author, message, is_hidden, created_at, updated_at')
            .maybeSingle();

        if (error) {
            console.error('관리자 댓글 상태 변경 오류:', error);
            return NextResponse.json({ error: '댓글 상태를 변경하지 못했습니다.' }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 404 });
        }

        return NextResponse.json({ comment: toManagedComment(data as AdminCommentRow) });
    } catch (error) {
        console.error('관리자 댓글 상태 변경 API 오류:', error);
        return NextResponse.json({ error: '댓글 상태를 변경하지 못했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const admin = await getAdminSession(request);

        if (!admin) {
            return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: '댓글 ID가 필요합니다.' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { count, error } = await supabase.from('comments').delete({ count: 'exact' }).eq('id', id);

        if (error) {
            console.error('관리자 댓글 삭제 오류:', error);
            return NextResponse.json({ error: '댓글을 삭제하지 못했습니다.' }, { status: 500 });
        }

        if (count === 0) {
            return NextResponse.json({ error: '댓글을 찾지 못했습니다.' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('관리자 댓글 삭제 API 오류:', error);
        return NextResponse.json({ error: '댓글을 삭제하지 못했습니다.' }, { status: 500 });
    }
}
