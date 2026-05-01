#!/usr/bin/env node

// 관리자 비밀번호 해시 생성용 스크립트입니다.
// 사용법: node scripts/hash-admin-password.mjs "원하는_관리자_비밀번호"
// 출력된 scrypt:...:... 전체 문자열을 Supabase comment_admins.password_hash에 저장하세요.

import { randomBytes, scryptSync } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/hash-admin-password.mjs "<admin-password>"');
    process.exit(1);
}

if (password.length < 4 || password.length > 128) {
    console.error('Password must be between 4 and 128 characters.');
    process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');

console.log(`${HASH_PREFIX}:${salt}:${hash}`);
