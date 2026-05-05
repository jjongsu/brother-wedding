'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { COMMENT_REACTION_TYPES, type CommentReactionCounts } from '@lib/comments/reactions';
import styled from 'styled-components';

type CommentStatus = 'visible' | 'hidden';
type CommentFilter = 'all' | CommentStatus;
type CommentKind = 'comment' | 'reply';
type SessionState = 'checking' | 'guest' | 'authenticated';

type ManagedComment = {
    id: string;
    parentId: string | null;
    parentAuthor?: string | null;
    author: string;
    message: string;
    createdAt: string;
    updatedAt?: string;
    status: CommentStatus;
};

type PreviewComment = {
    id: string;
    parentId: string | null;
    author: string;
    message: string;
    createdAt: string;
    reactions: CommentReactionCounts;
    replies: PreviewComment[];
};

type AdminSessionResponse = {
    authenticated: boolean;
    admin: {
        username: string;
    } | null;
};

type AdminCommentsResponse = {
    comments?: ManagedComment[];
    error?: string;
};

type PublicCommentsResponse = {
    comments?: PreviewComment[];
    error?: string;
};

const PREVIEW_REACTION_LABELS: Record<keyof CommentReactionCounts, string> = {
    like: '👍',
    heart: '❤️',
    clap: '👏',
    celebrate: '🎉',
};
const ADMIN_COMMENT_SKELETON_COUNT = 4;
const PREVIEW_COMMENT_SKELETON_COUNT = 3;

const getResponseBody = async <T,>(response: Response): Promise<T | null> => {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
};

const formatDateTime = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const countPreviewComments = (comments: PreviewComment[]): number => {
    return comments.reduce((total, comment) => total + 1 + countPreviewComments(comment.replies), 0);
};

const getManagedCommentKind = (comment: ManagedComment): CommentKind => {
    return comment.parentId ? 'reply' : 'comment';
};

export default function AdminPage() {
    const [adminId, setAdminId] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminName, setAdminName] = useState('');
    const [sessionState, setSessionState] = useState<SessionState>('checking');
    const [filter, setFilter] = useState<CommentFilter>('all');
    const [comments, setComments] = useState<ManagedComment[]>([]);
    const [loginError, setLoginError] = useState('');
    const [listError, setListError] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [previewComments, setPreviewComments] = useState<PreviewComment[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

    const loadComments = useCallback(async () => {
        setIsLoadingComments(true);
        setListError('');

        try {
            const response = await fetch('/api/admin/comments', {
                cache: 'no-store',
            });
            const body = await getResponseBody<AdminCommentsResponse>(response);

            if (response.status === 401) {
                setSessionState('guest');
                setComments([]);
                setListError('');
                return;
            }

            if (!response.ok) {
                throw new Error(body?.error ?? '댓글 목록을 불러오지 못했습니다.');
            }

            setComments(body?.comments ?? []);
        } catch (error) {
            setListError(error instanceof Error ? error.message : '댓글 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoadingComments(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            try {
                const response = await fetch('/api/admin/session', {
                    cache: 'no-store',
                });
                const body = await getResponseBody<AdminSessionResponse>(response);

                if (!isMounted) return;

                if (response.ok && body?.authenticated && body.admin) {
                    setAdminName(body.admin.username);
                    setSessionState('authenticated');
                    await loadComments();
                    return;
                }

                setSessionState('guest');
            } catch {
                if (isMounted) {
                    setSessionState('guest');
                }
            }
        };

        void checkSession();

        return () => {
            isMounted = false;
        };
    }, [loadComments]);

    const stats = useMemo(() => {
        const visible = comments.filter((comment) => comment.status === 'visible').length;
        const hidden = comments.filter((comment) => comment.status === 'hidden').length;
        const rootComments = comments.filter((comment) => !comment.parentId).length;
        const replies = comments.filter((comment) => comment.parentId).length;

        return {
            total: comments.length,
            rootComments,
            replies,
            visible,
            hidden,
        };
    }, [comments]);

    const filteredComments = useMemo(() => {
        if (filter === 'all') return comments;

        return comments.filter((comment) => comment.status === filter);
    }, [comments, filter]);

    const previewCount = useMemo(() => countPreviewComments(previewComments), [previewComments]);

    const loadPreviewComments = useCallback(async () => {
        setIsLoadingPreview(true);
        setPreviewError('');

        try {
            const response = await fetch('/api/comments', {
                cache: 'no-store',
            });
            const body = await getResponseBody<PublicCommentsResponse>(response);

            if (!response.ok) {
                throw new Error(body?.error ?? '미리보기를 불러오지 못했습니다.');
            }

            setPreviewComments(body?.comments ?? []);
        } catch (error) {
            setPreviewError(error instanceof Error ? error.message : '미리보기를 불러오지 못했습니다.');
        } finally {
            setIsLoadingPreview(false);
        }
    }, []);

    const openPreview = useCallback(() => {
        setIsPreviewOpen(true);
        void loadPreviewComments();
    }, [loadPreviewComments]);

    const closePreview = useCallback(() => {
        setIsPreviewOpen(false);
        setPreviewError('');
    }, []);

    useEffect(() => {
        if (!isPreviewOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closePreview();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closePreview, isPreviewOpen]);

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!adminId.trim() || !adminPassword.trim()) {
            setLoginError('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setLoginError('');

        try {
            const response = await fetch('/api/admin/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: adminId,
                    password: adminPassword,
                }),
            });
            const body = await getResponseBody<AdminSessionResponse & { error?: string }>(response);

            if (!response.ok || !body?.authenticated || !body.admin) {
                throw new Error(body?.error ?? '아이디 또는 비밀번호를 확인해주세요.');
            }

            setAdminName(body.admin.username);
            setSessionState('authenticated');
            setAdminPassword('');
            await loadComments();
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : '관리자 로그인에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/admin/session', {
            method: 'DELETE',
        });

        setSessionState('guest');
        setAdminId('');
        setAdminPassword('');
        setAdminName('');
        setFilter('all');
        setComments([]);
        setListError('');
    };

    const updateCommentStatus = async (id: string, status: CommentStatus) => {
        setPendingCommentId(id);
        setListError('');

        try {
            const response = await fetch(`/api/admin/comments/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    isHidden: status === 'hidden',
                }),
            });
            const body = await getResponseBody<{ comment?: ManagedComment; error?: string }>(response);

            if (response.status === 401) {
                setSessionState('guest');
                setComments([]);
                return;
            }

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? '댓글 상태를 변경하지 못했습니다.');
            }

            setComments((currentComments) =>
                currentComments.map((comment) =>
                    comment.id === id && body.comment
                        ? {
                              ...comment,
                              ...body.comment,
                              parentAuthor: body.comment.parentAuthor ?? comment.parentAuthor ?? null,
                          }
                        : comment,
                ),
            );
        } catch (error) {
            setListError(error instanceof Error ? error.message : '댓글 상태를 변경하지 못했습니다.');
        } finally {
            setPendingCommentId(null);
        }
    };

    const deleteComment = async (id: string) => {
        if (!window.confirm('이 댓글을 완전히 삭제할까요?')) return;

        setPendingCommentId(id);
        setListError('');

        try {
            const response = await fetch(`/api/admin/comments/${id}`, {
                method: 'DELETE',
            });
            const body = await getResponseBody<{ error?: string }>(response);

            if (response.status === 401) {
                setSessionState('guest');
                setComments([]);
                return;
            }

            if (!response.ok) {
                throw new Error(body?.error ?? '댓글을 삭제하지 못했습니다.');
            }

            setComments((currentComments) => currentComments.filter((comment) => comment.id !== id));
        } catch (error) {
            setListError(error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.');
        } finally {
            setPendingCommentId(null);
        }
    };

    if (sessionState !== 'authenticated') {
        return (
            <AdminShell>
                <LoginPanel>
                    <AdminMark>관리자</AdminMark>
                    <LoginTitle>댓글 관리</LoginTitle>
                    <LoginCopy>관리자 계정으로 접속하면 댓글의 노출 상태를 관리할 수 있습니다.</LoginCopy>

                    {sessionState === 'checking' ? (
                        <InfoText>인증 상태를 확인하고 있습니다.</InfoText>
                    ) : (
                        <LoginForm onSubmit={handleLogin}>
                            <Field>
                                <FieldLabel htmlFor="admin-id">아이디</FieldLabel>
                                <TextInput
                                    id="admin-id"
                                    value={adminId}
                                    onChange={(event) => setAdminId(event.target.value)}
                                    autoComplete="username"
                                    placeholder="관리자 아이디"
                                    disabled={isSubmitting}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="admin-password">비밀번호</FieldLabel>
                                <TextInput
                                    id="admin-password"
                                    type="password"
                                    value={adminPassword}
                                    onChange={(event) => setAdminPassword(event.target.value)}
                                    autoComplete="current-password"
                                    placeholder="관리자 비밀번호"
                                    disabled={isSubmitting}
                                />
                            </Field>
                            {loginError && <ErrorText role="alert">{loginError}</ErrorText>}
                            <PrimaryButton type="submit" disabled={isSubmitting}>
                                {isSubmitting ? '확인 중...' : '접속하기'}
                            </PrimaryButton>
                        </LoginForm>
                    )}
                </LoginPanel>
            </AdminShell>
        );
    }

    return (
        <AdminShell>
            <Dashboard>
                <TopBar>
                    <div>
                        <AdminMark>관리자</AdminMark>
                        <DashboardTitle>댓글 관리</DashboardTitle>
                        {adminName && <AdminName>{adminName}</AdminName>}
                    </div>
                    <LogoutButton type="button" onClick={handleLogout}>
                        로그아웃
                    </LogoutButton>
                </TopBar>

                <SummaryGrid>
                    <SummaryItem>
                        <SummaryLabel>전체</SummaryLabel>
                        <SummaryValue>{stats.total}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>댓글</SummaryLabel>
                        <SummaryValue>{stats.rootComments}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>답글</SummaryLabel>
                        <SummaryValue>{stats.replies}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>보임</SummaryLabel>
                        <SummaryValue>{stats.visible}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>숨김</SummaryLabel>
                        <SummaryValue>{stats.hidden}</SummaryValue>
                    </SummaryItem>
                </SummaryGrid>

                <WorkspaceHeader>
                    <WorkspaceTitle>댓글 목록</WorkspaceTitle>
                    <WorkspaceActions>
                        <RefreshButton type="button" onClick={loadComments} disabled={isLoadingComments}>
                            새로고침
                        </RefreshButton>
                        <PreviewButton type="button" onClick={openPreview} disabled={isLoadingPreview}>
                            {isLoadingPreview ? '준비 중...' : '미리보기'}
                        </PreviewButton>
                        <FilterGroup aria-label="댓글 상태 필터">
                            <FilterButton type="button" $active={filter === 'all'} onClick={() => setFilter('all')}>
                                전체
                            </FilterButton>
                            <FilterButton type="button" $active={filter === 'visible'} onClick={() => setFilter('visible')}>
                                보임
                            </FilterButton>
                            <FilterButton type="button" $active={filter === 'hidden'} onClick={() => setFilter('hidden')}>
                                숨김
                            </FilterButton>
                        </FilterGroup>
                    </WorkspaceActions>
                </WorkspaceHeader>

                <CommentList>
                    {listError && <ErrorState role="alert">{listError}</ErrorState>}

                    {isLoadingComments && <AdminCommentSkeletonList />}

                    {!isLoadingComments &&
                        filteredComments.map((comment) => {
                            const isPending = pendingCommentId === comment.id;
                            const commentKind = getManagedCommentKind(comment);

                            return (
                                <CommentRow key={comment.id} $status={comment.status} $kind={commentKind}>
                                    <CommentMeta>
                                        <CommentKindBadge $kind={commentKind}>{commentKind === 'reply' ? '답글' : '댓글'}</CommentKindBadge>
                                        <CommentAuthor>{comment.author}</CommentAuthor>
                                        <CommentDate dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</CommentDate>
                                        <StatusBadge $status={comment.status}>{comment.status === 'visible' ? '보임' : '숨김'}</StatusBadge>
                                    </CommentMeta>
                                    {commentKind === 'reply' && (
                                        <ReplyContext>답글 대상: {comment.parentAuthor ? `${comment.parentAuthor}님의 댓글` : '원댓글 정보 없음'}</ReplyContext>
                                    )}
                                    <CommentMessage>{comment.message}</CommentMessage>
                                    <ActionGroup>
                                        {comment.status === 'visible' ? (
                                            <SecondaryButton type="button" onClick={() => updateCommentStatus(comment.id, 'hidden')} disabled={isPending}>
                                                숨김
                                            </SecondaryButton>
                                        ) : (
                                            <SecondaryButton type="button" onClick={() => updateCommentStatus(comment.id, 'visible')} disabled={isPending}>
                                                보임
                                            </SecondaryButton>
                                        )}
                                        <DangerButton type="button" onClick={() => deleteComment(comment.id)} disabled={isPending}>
                                            삭제
                                        </DangerButton>
                                    </ActionGroup>
                                </CommentRow>
                            );
                        })}

                    {!isLoadingComments && !listError && filteredComments.length === 0 && <EmptyState>해당 상태의 댓글이 없습니다.</EmptyState>}
                </CommentList>
            </Dashboard>

            {isPreviewOpen && (
                <ModalOverlay role="presentation" onMouseDown={closePreview}>
                    <PreviewDialog role="dialog" aria-modal="true" aria-labelledby="comment-preview-title" onMouseDown={(event) => event.stopPropagation()}>
                        <PreviewHeader>
                            <div>
                                <PreviewEyebrow>방명록 미리보기</PreviewEyebrow>
                                <PreviewTitle id="comment-preview-title">현재 공개 댓글 {previewCount}개</PreviewTitle>
                            </div>
                            <PreviewHeaderActions>
                                <RefreshButton type="button" onClick={loadPreviewComments} disabled={isLoadingPreview}>
                                    새로고침
                                </RefreshButton>
                                <ModalCloseButton type="button" onClick={closePreview} aria-label="미리보기 닫기">
                                    닫기
                                </ModalCloseButton>
                            </PreviewHeaderActions>
                        </PreviewHeader>

                        <PreviewBody>
                            {isLoadingPreview && <PreviewCommentSkeletonList />}
                            {!isLoadingPreview && previewError && <PreviewState role="alert">{previewError}</PreviewState>}
                            {!isLoadingPreview && !previewError && previewComments.length === 0 && <PreviewState>현재 공개된 댓글이 없습니다.</PreviewState>}
                            {!isLoadingPreview && !previewError && previewComments.map((comment) => <PreviewCommentItem key={comment.id} comment={comment} />)}
                        </PreviewBody>
                    </PreviewDialog>
                </ModalOverlay>
            )}
        </AdminShell>
    );
}

function AdminCommentSkeletonList() {
    return (
        <AdminSkeletonStack role="status" aria-label="댓글 목록을 불러오는 중입니다.">
            {Array.from({ length: ADMIN_COMMENT_SKELETON_COUNT }, (_, index) => (
                <AdminSkeletonRow key={index} $delay={index * 0.07}>
                    <AdminSkeletonMeta>
                        <AdminSkeletonLine $width="5.4rem" $height="0.9rem" />
                        <AdminSkeletonLine $width="7.4rem" $height="0.72rem" />
                        <AdminSkeletonBadge />
                    </AdminSkeletonMeta>
                    <AdminSkeletonLine $width="100%" />
                    <AdminSkeletonLine $width="76%" />
                    <AdminSkeletonActions>
                        <AdminSkeletonButton />
                        <AdminSkeletonButton />
                    </AdminSkeletonActions>
                </AdminSkeletonRow>
            ))}
        </AdminSkeletonStack>
    );
}

function PreviewCommentItem({ comment, isReply = false }: { comment: PreviewComment; isReply?: boolean }) {
    return (
        <PreviewCommentCard $reply={isReply}>
            <PreviewCommentMeta>
                <PreviewAuthorGroup>
                    <PreviewCommentKind $reply={isReply}>{isReply ? '답글' : '댓글'}</PreviewCommentKind>
                    <PreviewCommentAuthor>{comment.author}</PreviewCommentAuthor>
                </PreviewAuthorGroup>
                <PreviewCommentDate dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</PreviewCommentDate>
            </PreviewCommentMeta>
            <PreviewCommentMessage>{comment.message}</PreviewCommentMessage>
            <PreviewReactions aria-label="리액션 현황">
                {COMMENT_REACTION_TYPES.map((reactionType) => (
                    <PreviewReaction key={reactionType}>
                        <span aria-hidden="true">{PREVIEW_REACTION_LABELS[reactionType]}</span>
                        <span>{comment.reactions?.[reactionType] ?? 0}</span>
                    </PreviewReaction>
                ))}
            </PreviewReactions>
            {comment.replies.length > 0 && (
                <PreviewReplies>
                    {comment.replies.map((reply) => (
                        <PreviewCommentItem key={reply.id} comment={reply} isReply />
                    ))}
                </PreviewReplies>
            )}
        </PreviewCommentCard>
    );
}

function PreviewCommentSkeletonList() {
    return (
        <PreviewSkeletonStack role="status" aria-label="현재 공개 댓글을 불러오는 중입니다.">
            {Array.from({ length: PREVIEW_COMMENT_SKELETON_COUNT }, (_, index) => (
                <PreviewSkeletonCard key={index} $delay={index * 0.08}>
                    <PreviewSkeletonMeta>
                        <AdminSkeletonLine $width="5.2rem" $height="0.86rem" />
                        <AdminSkeletonLine $width="7rem" $height="0.7rem" />
                    </PreviewSkeletonMeta>
                    <AdminSkeletonLine $width="100%" />
                    <AdminSkeletonLine $width="68%" />
                    <PreviewSkeletonReactions>
                        <AdminSkeletonPill />
                        <AdminSkeletonPill />
                        <AdminSkeletonPill />
                    </PreviewSkeletonReactions>
                </PreviewSkeletonCard>
            ))}
        </PreviewSkeletonStack>
    );
}

const AdminShell = styled.main`
    min-height: 100vh;
    padding: 3rem 1.25rem;
    background:
        linear-gradient(180deg, rgba(248, 246, 242, 0.96), rgba(255, 255, 255, 0.98)),
        radial-gradient(circle at top left, rgba(212, 185, 150, 0.16), transparent 30%);
    color: var(--text-dark);
`;

const LoginPanel = styled.section`
    width: min(100%, 27rem);
    margin: min(12vh, 6rem) auto 0;
    padding: 2rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 10px 28px rgba(87, 70, 52, 0.08);
    animation: riseIn 0.4s ease both;
    box-sizing: border-box;

    @keyframes riseIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const AdminMark = styled.p`
    margin: 0 0 0.4rem;
    color: var(--secondary-color);
    font-size: 0.82rem;
    letter-spacing: 0.08em;
`;

const LoginTitle = styled.h1`
    margin: 0;
    font-size: 1.65rem;
    font-weight: 500;
`;

const LoginCopy = styled.p`
    margin: 0.85rem 0 1.5rem;
    color: var(--text-medium);
    font-size: 0.92rem;
    line-height: 1.7;
`;

const InfoText = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.9rem;
`;

const ErrorText = styled.p`
    margin: 0;
    color: #b98275;
    font-size: 0.84rem;
    line-height: 1.5;
`;

const LoginForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
`;

const FieldLabel = styled.label`
    color: var(--text-medium);
    font-size: 0.82rem;
`;

const TextInput = styled.input`
    width: 100%;
    height: 2.8rem;
    border: 1px solid #ede5db;
    border-radius: 6px;
    padding: 0 0.85rem;
    background-color: #fffdfb;
    color: var(--text-dark);
    font-family: inherit;
    font-size: 1rem;
    outline: none;
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        background-color 0.2s ease;

    &::placeholder {
        color: #b8aea3;
    }
    box-sizing: border-box;

    &:focus {
        border-color: var(--secondary-color);
        background-color: white;
        box-shadow: 0 0 0 3px rgba(212, 185, 150, 0.18);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.62;
    }
`;

const PrimaryButton = styled.button`
    height: 2.8rem;
    border: none;
    border-radius: 4px;
    background-color: var(--secondary-color);
    color: white;
    font-family: inherit;
    font-size: 0.95rem;
    cursor: pointer;
    transition:
        background-color 0.2s ease,
        transform 0.2s ease,
        box-shadow 0.2s ease;

    &:hover {
        background-color: #c4a986;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    }

    &:active {
        transform: translateY(1px);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        box-shadow: none;
        transform: none;
    }
`;

const Dashboard = styled.section`
    width: min(100%, 58rem);
    margin: 0 auto;
    animation: riseIn 0.35s ease both;
`;

const TopBar = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;

    @media (max-width: 560px) {
        align-items: flex-start;
        flex-direction: column;
    }
`;

const DashboardTitle = styled.h1`
    margin: 0;
    font-size: 1.8rem;
    font-weight: 500;
`;

const AdminName = styled.p`
    margin: 0.35rem 0 0;
    color: var(--text-light);
    font-size: 0.84rem;
`;

const LogoutButton = styled.button`
    border: 1px solid #e7dccf;
    border-radius: 4px;
    padding: 0.55rem 0.85rem;
    background-color: transparent;
    color: var(--text-medium);
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        border-color: var(--secondary-color);
        color: var(--secondary-color);
    }
`;

const SummaryGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.2rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
`;

const SummaryItem = styled.div`
    padding: 1rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const SummaryLabel = styled.p`
    margin: 0 0 0.35rem;
    color: var(--text-medium);
    font-size: 0.82rem;
`;

const SummaryValue = styled.strong`
    display: block;
    color: var(--secondary-color);
    font-size: 1.65rem;
    font-weight: 500;
    line-height: 1;
`;

const WorkspaceHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;

    @media (max-width: 560px) {
        align-items: flex-start;
        flex-direction: column;
    }
`;

const WorkspaceTitle = styled.h2`
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
`;

const WorkspaceActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;

    @media (max-width: 560px) {
        width: 100%;
    }
`;

const FilterGroup = styled.div`
    display: flex;
    gap: 0.35rem;
    padding: 0.25rem;
    border: 1px solid #eee5da;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.72);
`;

const FilterButton = styled.button<{ $active: boolean }>`
    border: none;
    border-radius: 4px;
    padding: 0.45rem 0.7rem;
    background-color: ${(props) => (props.$active ? 'var(--secondary-color)' : 'transparent')};
    color: ${(props) => (props.$active ? 'white' : 'var(--text-medium)')};
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
`;

const CommentList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const AdminSkeletonStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const CommentRow = styled.article<{ $status: CommentStatus; $kind: CommentKind }>`
    position: relative;
    padding: 1rem 1.15rem;
    border: 1px solid ${(props) => (props.$kind === 'reply' ? '#eadfd3' : 'transparent')};
    border-left: ${(props) => (props.$kind === 'reply' ? '4px solid #b98275' : '1px solid transparent')};
    border-radius: 8px;
    background-color: ${(props) => (props.$kind === 'reply' ? '#fffaf6' : 'white')};
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    opacity: ${(props) => (props.$status === 'hidden' ? 0.72 : 1)};
`;

const AdminSkeletonRow = styled.article<{ $delay: number }>`
    padding: 1rem 1.15rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    animation: adminSkeletonPulse 1.35s ease-in-out infinite;
    animation-delay: ${(props) => props.$delay}s;

    @keyframes adminSkeletonPulse {
        0%,
        100% {
            opacity: 0.72;
        }
        50% {
            opacity: 1;
        }
    }
`;

const AdminSkeletonMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.7rem;
`;

const AdminSkeletonLine = styled.span<{ $width: string; $height?: string }>`
    display: block;
    width: ${(props) => props.$width};
    max-width: 100%;
    height: ${(props) => props.$height ?? '0.78rem'};
    border-radius: 999px;
    margin-top: 0.45rem;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: adminSkeletonShimmer 1.2s ease-in-out infinite;

    @keyframes adminSkeletonShimmer {
        from {
            background-position: 120% 0;
        }
        to {
            background-position: -120% 0;
        }
    }
`;

const AdminSkeletonBadge = styled.span`
    width: 3.2rem;
    height: 1.3rem;
    border-radius: 999px;
    margin-left: auto;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: adminSkeletonShimmer 1.2s ease-in-out infinite;
`;

const AdminSkeletonActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.85rem;
`;

const AdminSkeletonButton = styled.span`
    width: 3.4rem;
    height: 2.05rem;
    border-radius: 4px;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: adminSkeletonShimmer 1.2s ease-in-out infinite;
`;

const CommentMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.55rem;
    flex-wrap: wrap;
`;

const CommentAuthor = styled.h3`
    margin: 0;
    font-size: 0.98rem;
    font-weight: 500;
`;

const CommentKindBadge = styled.span<{ $kind: CommentKind }>`
    display: inline-flex;
    align-items: center;
    height: 1.35rem;
    border-radius: 999px;
    padding: 0 0.5rem;
    background-color: ${(props) => (props.$kind === 'reply' ? 'rgba(185, 130, 117, 0.14)' : 'rgba(96, 132, 105, 0.13)')};
    color: ${(props) => (props.$kind === 'reply' ? '#a76d62' : '#607a62')};
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
`;

const CommentDate = styled.time`
    color: var(--text-light);
    font-size: 0.78rem;
`;

const StatusBadge = styled.span<{ $status: CommentStatus }>`
    margin-left: auto;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    background-color: ${(props) => (props.$status === 'visible' ? 'rgba(212, 185, 150, 0.18)' : '#f1eeee')};
    color: ${(props) => (props.$status === 'visible' ? 'var(--secondary-color)' : 'var(--text-light)')};
    font-size: 0.75rem;

    @media (max-width: 480px) {
        margin-left: 0;
    }
`;

const CommentMessage = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.92rem;
    line-height: 1.75;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;

const ReplyContext = styled.p`
    margin: -0.2rem 0 0.45rem;
    color: #a98967;
    font-size: 0.78rem;
    line-height: 1.5;
`;

const ActionGroup = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.85rem;
`;

const SecondaryButton = styled.button`
    border: 1px solid #e7dccf;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    background-color: transparent;
    color: var(--text-medium);
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        border-color: var(--secondary-color);
        color: var(--secondary-color);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
`;

const RefreshButton = styled(SecondaryButton)``;

const PreviewButton = styled(SecondaryButton)`
    border-color: rgba(212, 185, 150, 0.55);
    background-color: rgba(255, 253, 251, 0.86);
    color: var(--secondary-color);
`;

const DangerButton = styled(SecondaryButton)`
    border-color: rgba(185, 130, 117, 0.35);
    color: #b98275;

    &:hover {
        border-color: #b98275;
        color: #a76d62;
    }
`;

const EmptyState = styled.p`
    margin: 0;
    padding: 2rem 1rem;
    border-radius: 8px;
    background-color: white;
    color: var(--text-light);
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const ErrorState = styled(EmptyState)`
    color: #b98275;
`;

const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    background-color: rgba(48, 42, 36, 0.38);
    backdrop-filter: blur(3px);
    animation: overlayFade 0.2s ease both;

    @keyframes overlayFade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;

const PreviewDialog = styled.section`
    width: min(100%, 44rem);
    max-height: min(82vh, 46rem);
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background-color: #fffdfb;
    box-shadow: 0 20px 60px rgba(44, 34, 25, 0.22);
    overflow: hidden;
    animation: dialogRise 0.24s ease both;

    @keyframes dialogRise {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const PreviewHeader = styled.header`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.15rem 1.25rem;
    border-bottom: 1px solid #efe6db;
    background-color: white;

    @media (max-width: 520px) {
        flex-direction: column;
    }
`;

const PreviewEyebrow = styled.p`
    margin: 0 0 0.3rem;
    color: var(--secondary-color);
    font-size: 0.78rem;
`;

const PreviewTitle = styled.h2`
    margin: 0;
    font-size: 1.12rem;
    font-weight: 500;
`;

const PreviewHeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
`;

const ModalCloseButton = styled(SecondaryButton)`
    min-width: 4rem;
`;

const PreviewBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem 1.25rem;
    overflow-y: auto;
`;

const PreviewState = styled(EmptyState)`
    box-shadow: none;
    background-color: white;
`;

const PreviewSkeletonStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const PreviewSkeletonCard = styled.article<{ $delay: number }>`
    padding: 1rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    animation: adminSkeletonPulse 1.35s ease-in-out infinite;
    animation-delay: ${(props) => props.$delay}s;

    @keyframes adminSkeletonPulse {
        0%,
        100% {
            opacity: 0.72;
        }
        50% {
            opacity: 1;
        }
    }
`;

const PreviewSkeletonMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-bottom: 0.65rem;
`;

const PreviewSkeletonReactions = styled.div`
    display: flex;
    gap: 0.35rem;
    margin-top: 0.8rem;
`;

const AdminSkeletonPill = styled.span`
    width: 2.35rem;
    height: 1.8rem;
    border-radius: 6px;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: adminSkeletonShimmer 1.2s ease-in-out infinite;
`;

const PreviewCommentCard = styled.article<{ $reply?: boolean }>`
    padding: ${(props) => (props.$reply ? '0.05rem 0 0.05rem 0.8rem' : '1rem')};
    border-left: ${(props) => (props.$reply ? '1px solid #eadfd3' : 'none')};
    border-radius: ${(props) => (props.$reply ? '0' : '8px')};
    background-color: ${(props) => (props.$reply ? 'transparent' : 'white')};
    box-shadow: ${(props) => (props.$reply ? 'none' : '0 4px 6px rgba(0, 0, 0, 0.05)')};
`;

const PreviewCommentMeta = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.8rem;
    margin-bottom: 0.45rem;

    @media (max-width: 420px) {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.2rem;
    }
`;

const PreviewAuthorGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
`;

const PreviewCommentKind = styled.span<{ $reply?: boolean }>`
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    border-radius: 999px;
    padding: 0 0.45rem;
    background-color: ${(props) => (props.$reply ? 'rgba(185, 130, 117, 0.14)' : 'rgba(96, 132, 105, 0.13)')};
    color: ${(props) => (props.$reply ? '#a76d62' : '#607a62')};
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
`;

const PreviewCommentAuthor = styled.h3`
    margin: 0;
    color: var(--text-dark);
    font-size: 0.95rem;
    font-weight: 500;
`;

const PreviewCommentDate = styled.time`
    color: var(--text-light);
    font-size: 0.76rem;
    white-space: nowrap;
`;

const PreviewCommentMessage = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.9rem;
    line-height: 1.75;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;

const PreviewReactions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.7rem;
`;

const PreviewReaction = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 2.35rem;
    height: 1.8rem;
    border: 1px solid #efe6db;
    border-radius: 6px;
    padding: 0 0.45rem;
    background-color: #fffdfb;
    color: var(--text-light);
    font-size: 0.76rem;
`;

const PreviewReplies = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-top: 0.95rem;
`;
