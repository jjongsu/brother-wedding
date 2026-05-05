'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
    normalizeCommentReactionCounts,
    normalizeCommentReactionList,
    type CommentReactionCounts,
    type CommentReactionType,
} from '@lib/comments/reactions';
import styled from 'styled-components';

type CommentSectionProps = BaseComponentProps;

type ApiGuestComment = {
    id: string;
    parentId?: string | null;
    author: string;
    message: string;
    createdAt: string;
    reactions?: Partial<Record<CommentReactionType, number>>;
    myReactions?: unknown[];
    replies?: ApiGuestComment[];
};

type GuestComment = {
    id: string;
    parentId: string | null;
    author: string;
    message: string;
    createdAt: string;
    reactions: CommentReactionCounts;
    myReactions: CommentReactionType[];
    replies: GuestComment[];
};

type CommentAction = {
    id: string;
    mode: 'edit' | 'delete';
} | null;

type CommentsResponse = {
    comments?: ApiGuestComment[];
    comment?: ApiGuestComment;
    error?: string;
};

type ReactionResponse = {
    commentId?: string;
    reactions?: Partial<Record<CommentReactionType, number>>;
    myReactions?: unknown[];
    error?: string;
};

const COMMENT_CLIENT_KEY_STORAGE_KEY = 'brother-wedding-comment-client-key';
const COMMENT_SUBMIT_RETRY_MESSAGE = '축하 메시지 등록에 실패 했습니다. 잠시 후 다시 시도해주세요.';
const REPLY_SUBMIT_RETRY_MESSAGE = '답글 등록에 실패 했습니다. 잠시 후 다시 시도해주세요.';
const REACTION_RETRY_MESSAGE = '리액션을 반영하지 못했습니다. 잠시 후 다시 시도해주세요.';
const COMMENT_SKELETON_COUNT = 3;

const REACTION_OPTIONS = [
    { type: 'like', icon: '👍', label: '좋아요' },
    { type: 'heart', icon: '❤️', label: '하트' },
    { type: 'clap', icon: '👏', label: '박수' },
    { type: 'celebrate', icon: '🎉', label: '축하' },
] as const satisfies ReadonlyArray<{
    type: CommentReactionType;
    icon: string;
    label: string;
}>;

const getResponseBody = async <T,>(response: Response): Promise<T | null> => {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
};

const normalizeComment = (comment: ApiGuestComment): GuestComment => ({
    id: comment.id,
    parentId: comment.parentId ?? null,
    author: comment.author,
    message: comment.message,
    createdAt: comment.createdAt,
    reactions: normalizeCommentReactionCounts(comment.reactions),
    myReactions: normalizeCommentReactionList(comment.myReactions),
    replies: (comment.replies ?? []).map(normalizeComment),
});

const createFallbackClientKey = () => {
    return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateClientKey = () => {
    if (typeof window === 'undefined') return '';

    try {
        const storedClientKey = window.localStorage.getItem(COMMENT_CLIENT_KEY_STORAGE_KEY)?.trim();

        if (storedClientKey && storedClientKey.length >= 8 && storedClientKey.length <= 80) {
            return storedClientKey;
        }

        const nextClientKey =
            typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : createFallbackClientKey();

        window.localStorage.setItem(COMMENT_CLIENT_KEY_STORAGE_KEY, nextClientKey);

        return nextClientKey;
    } catch {
        return createFallbackClientKey();
    }
};

const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(date)
        .replace(/\. /g, '.')
        .replace(/\.$/, '');
};

const countComments = (comments: GuestComment[]): number => {
    return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
};

const fetchComments = async (clientKey?: string) => {
    const query = clientKey ? `?clientKey=${encodeURIComponent(clientKey)}` : '';
    const response = await fetch(`/api/comments${query}`, {
        cache: 'no-store',
    });
    const body = await getResponseBody<CommentsResponse>(response);

    if (!response.ok) {
        throw new Error(body?.error ?? '댓글 목록을 불러오지 못했습니다.');
    }

    return (body?.comments ?? []).map(normalizeComment);
};

const updateCommentInTree = (
    comments: GuestComment[],
    commentId: string,
    updater: (comment: GuestComment) => GuestComment,
): GuestComment[] => {
    return comments.map((comment) => {
        if (comment.id === commentId) {
            return updater(comment);
        }

        return {
            ...comment,
            replies: updateCommentInTree(comment.replies, commentId, updater),
        };
    });
};

const removeCommentFromTree = (comments: GuestComment[], commentId: string): GuestComment[] => {
    return comments
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({
            ...comment,
            replies: removeCommentFromTree(comment.replies, commentId),
        }));
};

const findCommentInTree = (comments: GuestComment[], commentId: string): GuestComment | null => {
    for (const comment of comments) {
        if (comment.id === commentId) {
            return comment;
        }

        const reply = findCommentInTree(comment.replies, commentId);

        if (reply) {
            return reply;
        }
    }

    return null;
};

const insertCommentInTree = (comments: GuestComment[], nextComment: GuestComment): GuestComment[] => {
    if (!nextComment.parentId) {
        return [nextComment, ...comments];
    }

    return comments.map((comment) => {
        if (comment.id === nextComment.parentId) {
            return {
                ...comment,
                replies: [...comment.replies, nextComment],
            };
        }

        return {
            ...comment,
            replies: insertCommentInTree(comment.replies, nextComment),
        };
    });
};

const applyOptimisticReaction = (comment: GuestComment, reaction: CommentReactionType): GuestComment => {
    const isActive = comment.myReactions.includes(reaction);
    const currentCount = comment.reactions[reaction] ?? 0;

    return {
        ...comment,
        reactions: {
            ...comment.reactions,
            [reaction]: Math.max(0, currentCount + (isActive ? -1 : 1)),
        },
        myReactions: isActive
            ? comment.myReactions.filter((myReaction) => myReaction !== reaction)
            : [...comment.myReactions, reaction],
    };
};

export default function CommentSection({ bgColor = 'white' }: CommentSectionProps) {
    const [comments, setComments] = useState<GuestComment[]>([]);
    const [clientKey, setClientKey] = useState('');
    const [author, setAuthor] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
    const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(() => new Set());
    const [replyAuthor, setReplyAuthor] = useState('');
    const [replyPassword, setReplyPassword] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [activeAction, setActiveAction] = useState<CommentAction>(null);
    const [actionPassword, setActionPassword] = useState('');
    const [editMessage, setEditMessage] = useState('');
    const [pendingReaction, setPendingReaction] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReplySubmitting, setIsReplySubmitting] = useState(false);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [replyError, setReplyError] = useState('');
    const [listError, setListError] = useState('');
    const [actionError, setActionError] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    const totalCommentCount = useMemo(() => countComments(comments), [comments]);

    const loadComments = useCallback(async () => {
        setIsLoading(true);
        setListError('');
        setToastMessage('');

        try {
            const nextComments = await fetchComments(clientKey);

            setComments(nextComments);
        } catch (error) {
            setListError(error instanceof Error ? error.message : '댓글 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [clientKey]);

    useEffect(() => {
        let isMounted = true;

        const loadInitialComments = async () => {
            const nextClientKey = getOrCreateClientKey();

            try {
                const nextComments = await fetchComments(nextClientKey);

                if (!isMounted) return;

                setClientKey(nextClientKey);
                setComments(nextComments);
            } catch (error) {
                if (isMounted) {
                    setClientKey(nextClientKey);
                    setListError(error instanceof Error ? error.message : '댓글 목록을 불러오지 못했습니다.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadInitialComments();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!toastMessage) return;

        const timeoutId = window.setTimeout(() => {
            setToastMessage('');
        }, 3200);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [toastMessage]);

    const resetForm = () => {
        setAuthor('');
        setPassword('');
        setMessage('');
        setFormError('');
    };

    const resetReply = () => {
        setReplyTargetId(null);
        setReplyAuthor('');
        setReplyPassword('');
        setReplyMessage('');
        setReplyError('');
    };

    const resetAction = () => {
        setActiveAction(null);
        setActionPassword('');
        setEditMessage('');
        setActionError('');
    };

    const expandReplies = (commentId: string) => {
        setExpandedReplyIds((currentIds) => {
            if (currentIds.has(commentId)) return currentIds;

            const nextIds = new Set(currentIds);
            nextIds.add(commentId);

            return nextIds;
        });
    };

    const toggleReplies = (commentId: string) => {
        setExpandedReplyIds((currentIds) => {
            const nextIds = new Set(currentIds);

            if (nextIds.has(commentId)) {
                nextIds.delete(commentId);
            } else {
                nextIds.add(commentId);
            }

            return nextIds;
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedAuthor = author.trim();
        const trimmedPassword = password.trim();
        const trimmedMessage = message.trim();

        if (!trimmedAuthor || !trimmedPassword || !trimmedMessage) {
            setFormError('이름, 비밀번호, 메시지를 모두 입력해주세요.');
            return;
        }

        if (trimmedPassword.length < 4) {
            setFormError('비밀번호는 4자 이상 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    author: trimmedAuthor,
                    password: trimmedPassword,
                    message: trimmedMessage,
                }),
            });
            const body = await getResponseBody<CommentsResponse>(response);

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? COMMENT_SUBMIT_RETRY_MESSAGE);
            }

            setComments((currentComments) => insertCommentInTree(currentComments, normalizeComment(body.comment as ApiGuestComment)));
            resetForm();
        } catch {
            setFormError(COMMENT_SUBMIT_RETRY_MESSAGE);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReplySubmit = async (event: FormEvent<HTMLFormElement>, parentId: string) => {
        event.preventDefault();

        const trimmedAuthor = replyAuthor.trim();
        const trimmedPassword = replyPassword.trim();
        const trimmedMessage = replyMessage.trim();

        if (!trimmedAuthor || !trimmedPassword || !trimmedMessage) {
            setReplyError('이름, 비밀번호, 답글을 모두 입력해주세요.');
            return;
        }

        if (trimmedPassword.length < 4) {
            setReplyError('비밀번호는 4자 이상 입력해주세요.');
            return;
        }

        setIsReplySubmitting(true);
        setReplyError('');

        try {
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parentId,
                    author: trimmedAuthor,
                    password: trimmedPassword,
                    message: trimmedMessage,
                }),
            });
            const body = await getResponseBody<CommentsResponse>(response);

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? REPLY_SUBMIT_RETRY_MESSAGE);
            }

            setComments((currentComments) => insertCommentInTree(currentComments, normalizeComment(body.comment as ApiGuestComment)));
            expandReplies(parentId);
            resetReply();
        } catch {
            setReplyError(REPLY_SUBMIT_RETRY_MESSAGE);
        } finally {
            setIsReplySubmitting(false);
        }
    };

    const openReply = (comment: GuestComment) => {
        if (replyTargetId === comment.id) {
            resetReply();
            return;
        }

        resetAction();
        setReplyTargetId(comment.id);
        expandReplies(comment.id);
        setReplyAuthor('');
        setReplyPassword('');
        setReplyMessage('');
        setReplyError('');
    };

    const openAction = (comment: GuestComment, mode: 'edit' | 'delete') => {
        resetReply();
        setActiveAction({ id: comment.id, mode });
        setActionPassword('');
        setEditMessage(comment.message);
        setActionError('');
    };

    const handleReaction = async (commentId: string, reaction: CommentReactionType) => {
        if (!clientKey) return;

        const pendingKey = `${commentId}:${reaction}`;
        const previousComment = findCommentInTree(comments, commentId);

        if (!previousComment) return;

        const previousReactionState = {
            reactions: previousComment.reactions,
            myReactions: previousComment.myReactions,
        };

        setPendingReaction(pendingKey);
        setToastMessage('');
        setComments((currentComments) =>
            updateCommentInTree(currentComments, commentId, (comment) => applyOptimisticReaction(comment, reaction)),
        );

        try {
            const response = await fetch(`/api/comments/${commentId}/reactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reaction,
                    clientKey,
                }),
            });
            const body = await getResponseBody<ReactionResponse>(response);

            if (!response.ok) {
                throw new Error(body?.error ?? '리액션을 반영하지 못했습니다.');
            }

            setComments((currentComments) =>
                updateCommentInTree(currentComments, commentId, (comment) => ({
                    ...comment,
                    reactions: normalizeCommentReactionCounts(body?.reactions),
                    myReactions: normalizeCommentReactionList(body?.myReactions),
                })),
            );
        } catch {
            setComments((currentComments) =>
                updateCommentInTree(currentComments, commentId, (comment) => ({
                    ...comment,
                    reactions: previousReactionState.reactions,
                    myReactions: previousReactionState.myReactions,
                })),
            );

            setToastMessage(REACTION_RETRY_MESSAGE);
        } finally {
            setPendingReaction(null);
        }
    };

    const handleEdit = async () => {
        if (!activeAction) return;

        const trimmedMessage = editMessage.trim();
        const trimmedPassword = actionPassword.trim();

        if (!trimmedMessage || !trimmedPassword) {
            setActionError('댓글 비밀번호와 수정할 메시지를 입력해주세요.');
            return;
        }

        setIsActionSubmitting(true);
        setActionError('');

        try {
            const response = await fetch(`/api/comments/${activeAction.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: trimmedMessage,
                    password: trimmedPassword,
                }),
            });
            const body = await getResponseBody<CommentsResponse>(response);

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? '댓글을 수정하지 못했습니다.');
            }

            const nextComment = normalizeComment(body.comment);

            setComments((currentComments) =>
                updateCommentInTree(currentComments, activeAction.id, (comment) => ({
                    ...comment,
                    author: nextComment.author,
                    message: nextComment.message,
                    createdAt: nextComment.createdAt,
                })),
            );
            resetAction();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '댓글을 수정하지 못했습니다.');
        } finally {
            setIsActionSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!activeAction) return;

        const trimmedPassword = actionPassword.trim();

        if (!trimmedPassword) {
            setActionError('댓글 비밀번호를 입력해주세요.');
            return;
        }

        setIsActionSubmitting(true);
        setActionError('');

        try {
            const response = await fetch(`/api/comments/${activeAction.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    password: trimmedPassword,
                }),
            });
            const body = await getResponseBody<CommentsResponse>(response);

            if (!response.ok) {
                throw new Error(body?.error ?? '댓글을 삭제하지 못했습니다.');
            }

            setComments((currentComments) => removeCommentFromTree(currentComments, activeAction.id));
            resetAction();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.');
        } finally {
            setIsActionSubmitting(false);
        }
    };

    const renderReactionBar = (comment: GuestComment) => (
        <ReactionGroup aria-label="리액션">
            {REACTION_OPTIONS.map((reaction) => {
                const pendingKey = `${comment.id}:${reaction.type}`;
                const isActive = comment.myReactions.includes(reaction.type);
                const count = comment.reactions[reaction.type];

                return (
                    <ReactionButton
                        key={reaction.type}
                        type="button"
                        aria-label={`${reaction.label} ${isActive ? '취소' : '남기기'}`}
                        aria-pressed={isActive}
                        $active={isActive}
                        onClick={() => handleReaction(comment.id, reaction.type)}
                        disabled={!clientKey || pendingReaction === pendingKey}
                    >
                        <ReactionIcon aria-hidden="true">{reaction.icon}</ReactionIcon>
                        <ReactionCount>{count}</ReactionCount>
                    </ReactionButton>
                );
            })}
        </ReactionGroup>
    );

    const renderActionPanel = () => {
        if (!activeAction) return null;

        return (
            <ActionPanel>
                {activeAction.mode === 'edit' ? (
                    <>
                        <PanelTextarea
                            value={editMessage}
                            onChange={(event) => setEditMessage(event.target.value)}
                            maxLength={500}
                            disabled={isActionSubmitting}
                        />
                        <PanelInput
                            type="password"
                            value={actionPassword}
                            onChange={(event) => setActionPassword(event.target.value)}
                            autoComplete="current-password"
                            placeholder="댓글 비밀번호"
                            disabled={isActionSubmitting}
                        />
                        {actionError && <FeedbackText role="alert">{actionError}</FeedbackText>}
                        <PanelActions>
                            <PanelButton type="button" onClick={handleEdit} disabled={isActionSubmitting}>
                                {isActionSubmitting ? '저장 중...' : '저장'}
                            </PanelButton>
                            <GhostButton type="button" onClick={resetAction} disabled={isActionSubmitting}>
                                취소
                            </GhostButton>
                        </PanelActions>
                    </>
                ) : (
                    <>
                        <DeleteText>이 메시지를 삭제할까요?</DeleteText>
                        <PanelInput
                            type="password"
                            value={actionPassword}
                            onChange={(event) => setActionPassword(event.target.value)}
                            autoComplete="current-password"
                            placeholder="댓글 비밀번호"
                            disabled={isActionSubmitting}
                        />
                        {actionError && <FeedbackText role="alert">{actionError}</FeedbackText>}
                        <PanelActions>
                            <DangerButton type="button" onClick={handleDelete} disabled={isActionSubmitting}>
                                {isActionSubmitting ? '삭제 중...' : '삭제'}
                            </DangerButton>
                            <GhostButton type="button" onClick={resetAction} disabled={isActionSubmitting}>
                                취소
                            </GhostButton>
                        </PanelActions>
                    </>
                )}
            </ActionPanel>
        );
    };

    const renderCommentContent = (comment: GuestComment, isReply = false) => {
        const isActive = activeAction?.id === comment.id;

        return (
            <>
                <CommentHeader $compact={isReply}>
                    <CommentAuthor>{comment.author}</CommentAuthor>
                    <CommentDate dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</CommentDate>
                </CommentHeader>
                <CommentMessage>{comment.message}</CommentMessage>

                <CommentMetaRow>
                    {renderReactionBar(comment)}

                    <CommentActions>
                        {!isReply && (
                            <TextButton type="button" onClick={() => openReply(comment)} disabled={isReplySubmitting}>
                                {replyTargetId === comment.id ? '닫기' : '답글'}
                            </TextButton>
                        )}
                        <TextButton type="button" onClick={() => openAction(comment, 'edit')} disabled={isActionSubmitting}>
                            수정
                        </TextButton>
                        <TextButton type="button" onClick={() => openAction(comment, 'delete')} disabled={isActionSubmitting}>
                            삭제
                        </TextButton>
                    </CommentActions>
                </CommentMetaRow>

                {isActive && renderActionPanel()}
            </>
        );
    };

    const renderReplyForm = (comment: GuestComment) => (
        <ReplyForm onSubmit={(event) => handleReplySubmit(event, comment.id)}>
            <ReplyFormTitle>{comment.author}님에게 답글</ReplyFormTitle>
            <FieldGroup>
                <CompactField>
                    <FieldLabel htmlFor={`reply-author-${comment.id}`}>이름</FieldLabel>
                    <TextInput
                        id={`reply-author-${comment.id}`}
                        value={replyAuthor}
                        onChange={(event) => setReplyAuthor(event.target.value)}
                        maxLength={40}
                        autoComplete="name"
                        placeholder="이름"
                        disabled={isReplySubmitting}
                    />
                </CompactField>

                <CompactField>
                    <FieldLabel htmlFor={`reply-password-${comment.id}`}>비밀번호</FieldLabel>
                    <TextInput
                        id={`reply-password-${comment.id}`}
                        type="password"
                        value={replyPassword}
                        onChange={(event) => setReplyPassword(event.target.value)}
                        maxLength={40}
                        autoComplete="new-password"
                        placeholder="수정/삭제용"
                        disabled={isReplySubmitting}
                    />
                </CompactField>
            </FieldGroup>

            <Field>
                <FieldLabel htmlFor={`reply-message-${comment.id}`}>답글</FieldLabel>
                <ReplyInput
                    id={`reply-message-${comment.id}`}
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    maxLength={500}
                    placeholder="답글을 적어주세요."
                    disabled={isReplySubmitting}
                />
            </Field>

            <FormFooter>
                <CountText>{replyMessage.length}/500</CountText>
                <PanelActions>
                    <GhostButton type="button" onClick={resetReply} disabled={isReplySubmitting}>
                        취소
                    </GhostButton>
                    <PanelButton type="submit" disabled={isReplySubmitting}>
                        {isReplySubmitting ? '등록 중...' : '답글 등록'}
                    </PanelButton>
                </PanelActions>
            </FormFooter>
            {replyError && <FeedbackText role="alert">{replyError}</FeedbackText>}
        </ReplyForm>
    );

    return (
        <CommentSectionContainer $bgColor={bgColor}>
            <SectionTitle>축하 메시지</SectionTitle>
            <SectionIntro>두 사람에게 전하고 싶은 마음을 남겨주세요.</SectionIntro>

            <CommentLayout>
                <CommentForm onSubmit={handleSubmit}>
                    <FieldGroup>
                        <CompactField>
                            <FieldLabel htmlFor="comment-author">이름</FieldLabel>
                            <TextInput
                                id="comment-author"
                                value={author}
                                onChange={(event) => setAuthor(event.target.value)}
                                maxLength={40}
                                autoComplete="name"
                                placeholder="이름"
                                disabled={isSubmitting}
                            />
                        </CompactField>

                        <CompactField>
                            <FieldLabel htmlFor="comment-password">비밀번호</FieldLabel>
                            <TextInput
                                id="comment-password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                maxLength={40}
                                autoComplete="new-password"
                                placeholder="수정/삭제용"
                                disabled={isSubmitting}
                            />
                        </CompactField>
                    </FieldGroup>

                    <Field>
                        <FieldLabel htmlFor="comment-message">메시지</FieldLabel>
                        <MessageInput
                            id="comment-message"
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            maxLength={500}
                            placeholder="축하의 마음을 적어주세요."
                            disabled={isSubmitting}
                        />
                    </Field>

                    <FormFooter>
                        <CountText>{message.length}/500</CountText>
                        <SubmitButton type="submit" disabled={isSubmitting}>
                            {isSubmitting ? '등록 중...' : '등록하기'}
                        </SubmitButton>
                    </FormFooter>
                    {formError && <FeedbackText role="alert">{formError}</FeedbackText>}
                </CommentForm>

                <CommentToolbar>
                    <CommentCount>방명록 {totalCommentCount}개</CommentCount>
                    <RefreshButton type="button" onClick={loadComments} disabled={isLoading}>
                        새로고침
                    </RefreshButton>
                </CommentToolbar>

                <CommentList>
                    {isLoading && <CommentSkeletonList />}
                    {!isLoading && listError && <StateMessage role="alert">{listError}</StateMessage>}
                    {!isLoading && !listError && comments.length === 0 && <StateMessage>아직 남겨진 메시지가 없습니다.</StateMessage>}

                    {!isLoading &&
                        !listError &&
                        comments.map((comment) => {
                            const isRepliesExpanded = expandedReplyIds.has(comment.id);
                            const replyListId = `reply-list-${comment.id}`;

                            return (
                                <CommentItem key={comment.id}>
                                    {renderCommentContent(comment)}

                                    {comment.replies.length > 0 && (
                                        <ReplyToggleButton
                                            type="button"
                                            aria-controls={replyListId}
                                            aria-expanded={isRepliesExpanded}
                                            onClick={() => toggleReplies(comment.id)}
                                        >
                                            <ReplyToggleIcon $expanded={isRepliesExpanded} aria-hidden="true" />
                                            {isRepliesExpanded ? `답글 ${comment.replies.length}개 접기` : `답글 ${comment.replies.length}개 보기`}
                                        </ReplyToggleButton>
                                    )}

                                    {replyTargetId === comment.id && renderReplyForm(comment)}

                                    {comment.replies.length > 0 && isRepliesExpanded && (
                                        <ReplyList id={replyListId}>
                                            {comment.replies.map((reply) => (
                                                <ReplyItem key={reply.id}>{renderCommentContent(reply, true)}</ReplyItem>
                                            ))}
                                        </ReplyList>
                                    )}
                                </CommentItem>
                            );
                        })}
                </CommentList>
            </CommentLayout>
            {toastMessage && <ToastMessage role="status">{toastMessage}</ToastMessage>}
        </CommentSectionContainer>
    );
}

function CommentSkeletonList() {
    return (
        <SkeletonGroup role="status" aria-label="댓글을 불러오는 중입니다.">
            {Array.from({ length: COMMENT_SKELETON_COUNT }, (_, index) => (
                <CommentSkeletonItem key={index} $delay={index * 0.08}>
                    <SkeletonHeader>
                        <SkeletonLine $width="5.8rem" $height="0.9rem" />
                        <SkeletonLine $width="4.6rem" $height="0.72rem" />
                    </SkeletonHeader>
                    <SkeletonLine $width="100%" />
                    <SkeletonLine $width="82%" />
                    <SkeletonReactionRow>
                        <SkeletonPill />
                        <SkeletonPill />
                        <SkeletonPill />
                    </SkeletonReactionRow>
                </CommentSkeletonItem>
            ))}
        </SkeletonGroup>
    );
}

const CommentSectionContainer = styled.section<{ $bgColor: 'white' | 'beige' }>`
    padding: 4rem 1.5rem;
    text-align: center;
    background-color: ${(props) => (props.$bgColor === 'beige' ? '#F8F6F2' : 'white')};
`;

const SectionTitle = styled.h2`
    position: relative;
    display: inline-block;
    margin-bottom: 2rem;
    font-weight: 500;
    font-size: 1.5rem;

    &::after {
        content: '';
        position: absolute;
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--secondary-color);
    }
`;

const SectionIntro = styled.p`
    max-width: 36rem;
    margin: 0 auto 2rem;
    color: var(--text-medium);
    font-size: 0.95rem;
    line-height: 1.8;
`;

const CommentLayout = styled.div`
    max-width: 42rem;
    margin: 0 auto;
    text-align: left;
`;

const CommentForm = styled.form`
    padding: 1.25rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const FieldGroup = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.85rem;

    @media (max-width: 520px) {
        grid-template-columns: 1fr;
    }
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
`;

const CompactField = styled(Field)``;

const FieldLabel = styled.label`
    color: var(--text-medium);
    font-size: 0.82rem;
`;

const inputBaseStyles = `
    width: 100%;
    border: 1px solid #ede5db;
    border-radius: 6px;
    background-color: #fffdfb;
    color: var(--text-dark);
    font-family: inherit;
    outline: none;
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        background-color 0.2s ease;

    &::placeholder {
        color: #b8aea3;
    }

    &:focus {
        border-color: var(--secondary-color);
        background-color: white;
        box-shadow: 0 0 0 3px rgba(212, 185, 150, 0.18);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.65;
    }
`;

const TextInput = styled.input`
    ${inputBaseStyles}
    height: 2.75rem;
    padding: 0 0.85rem;
    font-size: 1rem;
    box-sizing: border-box;
`;

const MessageInput = styled.textarea`
    ${inputBaseStyles}
    min-height: 7.5rem;
    resize: vertical;
    padding: 0.85rem;
    font-size: 1rem;
    line-height: 1.7;
    box-sizing: border-box;
`;

const ReplyInput = styled(MessageInput)`
    min-height: 5.25rem;
`;

const FormFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.9rem;

    @media (max-width: 420px) {
        align-items: stretch;
        flex-direction: column;
    }
`;

const CountText = styled.span`
    color: var(--text-light);
    font-size: 0.8rem;
`;

const SubmitButton = styled.button`
    min-width: 7rem;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 1.25rem;
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

const CommentToolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 1.75rem 0 0.75rem;
`;

const CommentCount = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.9rem;
`;

const RefreshButton = styled.button`
    border: 1px solid #e7dccf;
    border-radius: 4px;
    padding: 0.45rem 0.7rem;
    background-color: rgba(255, 255, 255, 0.68);
    color: var(--text-light);
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    transition:
        border-color 0.2s ease,
        color 0.2s ease,
        background-color 0.2s ease;

    &:hover {
        border-color: var(--secondary-color);
        background-color: white;
        color: var(--secondary-color);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.58;
    }
`;

const CommentList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
`;

const SkeletonGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
`;

const CommentSkeletonItem = styled.article<{ $delay: number }>`
    padding: 1.15rem 1.25rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    animation: skeletonPulse 1.35s ease-in-out infinite;
    animation-delay: ${(props) => props.$delay}s;

    @keyframes skeletonPulse {
        0%,
        100% {
            opacity: 0.72;
        }
        50% {
            opacity: 1;
        }
    }
`;

const SkeletonHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;
`;

const SkeletonLine = styled.span<{ $width: string; $height?: string }>`
    display: block;
    width: ${(props) => props.$width};
    max-width: 100%;
    height: ${(props) => props.$height ?? '0.82rem'};
    border-radius: 999px;
    margin-top: 0.55rem;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.2s ease-in-out infinite;

    @keyframes skeletonShimmer {
        from {
            background-position: 120% 0;
        }
        to {
            background-position: -120% 0;
        }
    }
`;

const SkeletonReactionRow = styled.div`
    display: flex;
    gap: 0.35rem;
    margin-top: 0.95rem;
`;

const SkeletonPill = styled.span`
    display: block;
    width: 2.65rem;
    height: 2rem;
    border-radius: 6px;
    background: linear-gradient(90deg, #f2ece4 0%, #fbf7f1 48%, #f2ece4 100%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.2s ease-in-out infinite;
`;

const StateMessage = styled.p`
    margin: 0;
    padding: 1.5rem 1rem;
    border-radius: 8px;
    background-color: white;
    color: var(--text-light);
    font-size: 0.9rem;
    line-height: 1.7;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const CommentItem = styled.article`
    padding: 1.15rem 1.25rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    animation: commentReveal 0.32s ease both;

    @keyframes commentReveal {
        from {
            opacity: 0;
            transform: translateY(8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const ReplyToggleButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.9rem;
    border: none;
    padding: 0;
    background: none;
    color: var(--text-light);
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
        color: var(--secondary-color);
    }
`;

const ReplyToggleIcon = styled.span<{ $expanded: boolean }>`
    display: inline-block;
    flex: 0 0 auto;
    width: 0.42rem;
    height: 0.42rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(${(props) => (props.$expanded ? '45deg' : '-45deg')});
    transition: transform 0.2s ease;
`;

const ReplyList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
    margin-top: 1rem;
    padding-left: 1rem;
    border-left: 1px solid #eadfd3;
    animation: repliesReveal 0.24s ease both;

    @media (max-width: 420px) {
        padding-left: 0.75rem;
    }

    @keyframes repliesReveal {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const ReplyItem = styled.article`
    padding: 0.05rem 0 0.05rem 0.75rem;
`;

const CommentHeader = styled.div<{ $compact?: boolean }>`
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: baseline;
    margin-bottom: ${(props) => (props.$compact ? '0.45rem' : '0.6rem')};

    @media (max-width: 420px) {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.25rem;
    }
`;

const CommentAuthor = styled.h3`
    margin: 0;
    font-size: 0.98rem;
    font-weight: 500;
    color: var(--text-dark);
`;

const CommentDate = styled.time`
    color: var(--text-light);
    font-size: 0.78rem;
    white-space: nowrap;
`;

const CommentMessage = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.92rem;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: keep-all;
`;

const CommentMetaRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    margin-top: 0.8rem;

    @media (max-width: 520px) {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.7rem;
    }
`;

const ReactionGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
`;

const ReactionButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-width: 2.65rem;
    height: 2rem;
    border: 1px solid ${(props) => (props.$active ? '#d9b28a' : '#efe6db')};
    border-radius: 6px;
    padding: 0 0.45rem;
    background-color: ${(props) => (props.$active ? '#fff2e4' : '#fffdfb')};
    color: var(--text-medium);
    font-family: inherit;
    cursor: pointer;
    transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        transform 0.2s ease;

    &:hover {
        border-color: var(--secondary-color);
        background-color: #fff8f0;
    }

    &:active {
        transform: translateY(1px);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.62;
        transform: none;
    }
`;

const ReactionIcon = styled.span`
    font-size: 0.95rem;
    line-height: 1;
`;

const ReactionCount = styled.span`
    min-width: 0.75rem;
    color: var(--text-light);
    font-size: 0.76rem;
    line-height: 1;
    text-align: center;
`;

const CommentActions = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.7rem;
    white-space: nowrap;
`;

const TextButton = styled.button`
    border: none;
    padding: 0;
    background: none;
    color: var(--text-light);
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
        color: var(--secondary-color);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

const ReplyForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f0e9df;
`;

const ReplyFormTitle = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.84rem;
`;

const ActionPanel = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-top: 0.9rem;
    padding-top: 0.9rem;
    border-top: 1px solid #f0e9df;
`;

const PanelInput = styled.input`
    ${inputBaseStyles}
    height: 2.55rem;
    padding: 0 0.75rem;
    font-size: 1rem;
    box-sizing: border-box;
`;

const PanelTextarea = styled.textarea`
    ${inputBaseStyles}
    min-height: 5.5rem;
    resize: vertical;
    padding: 0.75rem;
    font-size: 1rem;
    line-height: 1.7;
    box-sizing: border-box;
`;

const PanelActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
`;

const PanelButton = styled.button`
    border: none;
    border-radius: 4px;
    padding: 0.55rem 0.85rem;
    background-color: var(--secondary-color);
    color: white;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

const GhostButton = styled(PanelButton)`
    border: 1px solid #e7dccf;
    background-color: transparent;
    color: var(--text-medium);
`;

const DangerButton = styled(PanelButton)`
    background-color: #b98275;
`;

const DeleteText = styled.p`
    margin: 0;
    color: var(--text-medium);
    font-size: 0.9rem;
`;

const FeedbackText = styled.p`
    margin: 0.7rem 0 0;
    color: #b98275;
    font-size: 0.82rem;
    line-height: 1.6;
`;

const ToastMessage = styled.div`
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 30;
    max-width: min(21rem, calc(100vw - 2.5rem));
    border: 1px solid rgba(185, 130, 117, 0.28);
    border-radius: 8px;
    padding: 0.82rem 1rem;
    background-color: rgba(255, 253, 251, 0.96);
    color: #9a6d63;
    font-size: 0.84rem;
    line-height: 1.6;
    text-align: left;
    box-shadow: 0 12px 28px rgba(72, 54, 40, 0.14);
    animation: toastReveal 0.24s ease both;

    @media (max-width: 520px) {
        right: 1rem;
        bottom: 1rem;
        left: 1rem;
        max-width: none;
    }

    @keyframes toastReveal {
        from {
            opacity: 0;
            transform: translateY(8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
