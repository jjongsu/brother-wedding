#!/usr/bin/env node

import fs from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

const username = process.argv[2]?.trim();

if (!username) {
    console.error('Usage: node scripts/upsert-admin-password.mjs "<admin-username>"');
    process.exit(1);
}

const loadEnvFile = () => {
    if (!fs.existsSync('.env')) return;

    const content = fs.readFileSync('.env', 'utf8');

    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

        if (!match) continue;

        let value = match[2].trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[match[1]] = value;
    }
};

const getRequiredEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

const hashPassword = (password) => {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');

    return `${HASH_PREFIX}:${salt}:${hash}`;
};

const fetchWithTimeout = async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
        return await fetch(input, {
            ...init,
            signal: init.signal ?? controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
};

const readHiddenInput = (prompt) => {
    if (!process.stdin.isTTY) {
        return new Promise((resolve) => {
            process.stdin.setEncoding('utf8');
            process.stdin.once('data', (value) => resolve(value.replace(/\r?\n$/, '')));
        });
    }

    return new Promise((resolve) => {
        process.stdout.write(prompt);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        let value = '';

        const onData = (chunk) => {
            for (const char of chunk) {
                if (char === '\u0003') {
                    process.stdout.write('\n');
                    process.exit(130);
                }

                if (char === '\r' || char === '\n') {
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdin.off('data', onData);
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }

                if (char === '\u007f') {
                    value = value.slice(0, -1);
                    continue;
                }

                value += char;
            }
        };

        process.stdin.on('data', onData);
    });
};

const main = async () => {
    loadEnvFile();

    const password = await readHiddenInput(`Password for ${username}: `);

    if (password.length < 4 || password.length > 128) {
        throw new Error('Password must be between 4 and 128 characters.');
    }

    const supabase = createClient(getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            fetch: fetchWithTimeout,
        },
    });

    console.log('Connecting to Supabase...');

    const existing = await supabase.from('comment_admins').select('id, username, is_active').eq('username', username).maybeSingle();

    if (existing.error) {
        throw existing.error;
    }

    const payload = {
        password_hash: hashPassword(password),
        is_active: true,
    };

    const result = existing.data
        ? await supabase.from('comment_admins').update(payload).eq('id', existing.data.id).select('id, username, is_active').single()
        : await supabase.from('comment_admins').insert({ username, ...payload }).select('id, username, is_active').single();

    if (result.error) {
        throw result.error;
    }

    console.log(`${existing.data ? 'Updated' : 'Inserted'} admin: ${result.data.username} active=${result.data.is_active}`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
