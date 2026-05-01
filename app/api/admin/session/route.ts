import { NextResponse } from 'next/server';
import { clearAdminSessionCookie, getAdminSession, setAdminSessionCookie, verifyAdminCredentials } from '@lib/admin/auth';
import { checkRateLimit } from '@lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
    try {
        const admin = await getAdminSession(request);

        return NextResponse.json({
            authenticated: Boolean(admin),
            admin: admin ? { username: admin.username } : null,
        });
    } catch (error) {
        console.error('관리자 세션 확인 오류:', error);
        return NextResponse.json({ authenticated: false, admin: null }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'admin:login',
            limit: 5,
            windowMs: 5 * 60 * 1000,
        });

        if (rateLimit.limited) {
            return NextResponse.json(
                { error: '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimit.retryAfterSeconds),
                    },
                },
            );
        }

        const body = await parseJsonBody(request);
        const username = getTrimmedString(body?.username);
        const password = getTrimmedString(body?.password);

        if (username.length < 1 || username.length > 80 || password.length < 1 || password.length > 128) {
            return NextResponse.json({ error: '아이디 또는 비밀번호를 확인해주세요.' }, { status: 400 });
        }

        const admin = await verifyAdminCredentials(username, password);

        if (!admin) {
            return NextResponse.json({ error: '아이디 또는 비밀번호를 확인해주세요.' }, { status: 401 });
        }

        const response = NextResponse.json({
            authenticated: true,
            admin: { username: admin.username },
        });

        setAdminSessionCookie(response, admin);

        return response;
    } catch (error) {
        console.error('관리자 로그인 오류:', error);
        return NextResponse.json({ error: '관리자 로그인에 실패했습니다.' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true });

    clearAdminSessionCookie(response);

    return response;
}
