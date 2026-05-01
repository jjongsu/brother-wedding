import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextResponse } from 'next/server';
import { verifyPassword } from '@lib/comments/password';
import { createSupabaseAdminClient } from '@lib/supabase/server';

const ADMIN_SESSION_COOKIE_NAME = 'comment_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 6;

type AdminAccountRow = {
    id: string;
    username: string;
    password_hash: string;
    is_active: boolean;
};

type AdminSessionPayload = {
    sub: string;
    username: string;
    iat: number;
    exp: number;
    nonce: string;
};

export type AdminSession = {
    id: string;
    username: string;
};

const getSessionSecret = () => {
    const secret = process.env.COMMENT_ADMIN_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secret) {
        throw new Error('Missing COMMENT_ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY for admin sessions.');
    }

    return secret;
};

const getCookieValue = (request: Request, name: string) => {
    const cookieHeader = request.headers.get('cookie');

    if (!cookieHeader) return null;

    const cookie = cookieHeader
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${name}=`));

    if (!cookie) return null;

    try {
        return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
        return null;
    }
};

const signPayload = (payload: string) => {
    return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
};

const timingSafeStringEqual = (left: string, right: string) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
};

const isSessionPayload = (value: unknown): value is AdminSessionPayload => {
    if (!value || typeof value !== 'object') return false;

    const payload = value as Partial<AdminSessionPayload>;

    return (
        typeof payload.sub === 'string' &&
        typeof payload.username === 'string' &&
        typeof payload.iat === 'number' &&
        typeof payload.exp === 'number' &&
        typeof payload.nonce === 'string'
    );
};

const encodeSession = (payload: AdminSessionPayload) => {
    const payloadValue = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = signPayload(payloadValue);

    return `${payloadValue}.${signature}`;
};

const decodeSession = (value: string) => {
    const [payloadValue, signature] = value.split('.');

    if (!payloadValue || !signature) return null;

    const expectedSignature = signPayload(payloadValue);

    if (!timingSafeStringEqual(signature, expectedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadValue, 'base64url').toString('utf8'));

        return isSessionPayload(payload) ? payload : null;
    } catch {
        return null;
    }
};

const getActiveAdminById = async (id: string) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('comment_admins')
        .select('id, username, is_active')
        .eq('id', id)
        .maybeSingle<Pick<AdminAccountRow, 'id' | 'username' | 'is_active'>>();

    if (error) {
        throw error;
    }

    if (!data?.is_active) {
        return null;
    }

    return {
        id: data.id,
        username: data.username,
    };
};

export const verifyAdminCredentials = async (usernameValue: string, password: string): Promise<AdminSession | null> => {
    const username = usernameValue.trim();

    if (!username || !password) {
        return null;
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('comment_admins')
        .select('id, username, password_hash, is_active')
        .eq('username', username)
        .maybeSingle<AdminAccountRow>();

    if (error) {
        throw error;
    }

    if (!data?.is_active || !verifyPassword(password, data.password_hash)) {
        return null;
    }

    return {
        id: data.id,
        username: data.username,
    };
};

export const getAdminSession = async (request: Request): Promise<AdminSession | null> => {
    const sessionCookie = getCookieValue(request, ADMIN_SESSION_COOKIE_NAME);

    if (!sessionCookie) {
        return null;
    }

    const payload = decodeSession(sessionCookie);
    const now = Math.floor(Date.now() / 1000);

    if (!payload || payload.exp <= now) {
        return null;
    }

    const admin = await getActiveAdminById(payload.sub);

    if (!admin || admin.username !== payload.username) {
        return null;
    }

    return admin;
};

export const setAdminSessionCookie = (response: NextResponse, admin: AdminSession) => {
    const now = Math.floor(Date.now() / 1000);
    const value = encodeSession({
        sub: admin.id,
        username: admin.username,
        iat: now,
        exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
        nonce: randomBytes(12).toString('base64url'),
    });

    response.cookies.set({
        name: ADMIN_SESSION_COOKIE_NAME,
        value,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
};

export const clearAdminSessionCookie = (response: NextResponse) => {
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
};
