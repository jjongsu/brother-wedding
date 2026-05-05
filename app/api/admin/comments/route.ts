import { NextResponse } from 'next/server';
import { getAdminSession } from '@lib/admin/auth';
import { createSupabaseAdminClient } from '@lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminCommentRow = {
    id: string;
    parent_id: string | null;
    author: string;
    message: string;
    is_hidden: boolean;
    created_at: string;
    updated_at: string;
};

const toManagedComment = (comment: AdminCommentRow, parentAuthor?: string | null) => ({
    id: comment.id,
    parentId: comment.parent_id,
    parentAuthor: parentAuthor ?? null,
    author: comment.author,
    message: comment.message,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    status: comment.is_hidden ? 'hidden' : 'visible',
});

export async function GET(request: Request) {
    try {
        const admin = await getAdminSession(request);

        if (!admin) {
            return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
        }

        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('comments')
            .select('id, parent_id, author, message, is_hidden, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('관리자 댓글 목록 조회 오류:', error);
            return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
        }

        const comments = (data ?? []) as AdminCommentRow[];
        const authorById = new Map(comments.map((comment) => [comment.id, comment.author]));

        return NextResponse.json({
            comments: comments.map((comment) => toManagedComment(comment, comment.parent_id ? authorById.get(comment.parent_id) : null)),
        });
    } catch (error) {
        console.error('관리자 댓글 목록 API 오류:', error);
        return NextResponse.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }
}
