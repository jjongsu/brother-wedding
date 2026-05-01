'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

type CommentSectionProps = BaseComponentProps;

type GuestComment = {
    id: string;
    author: string;
    message: string;
    createdAt: string;
};

type CommentAction = {
    id: string;
    mode: 'edit' | 'delete';
} | null;

type CommentsResponse = {
    comments?: GuestComment[];
    comment?: GuestComment;
    error?: string;
};

const getResponseBody = async (response: Response): Promise<CommentsResponse | null> => {
    try {
        return (await response.json()) as CommentsResponse;
    } catch {
        return null;
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

const fetchComments = async () => {
    const response = await fetch('/api/comments', {
        cache: 'no-store',
    });
    const body = await getResponseBody(response);

    if (!response.ok) {
        throw new Error(body?.error ?? '댓글 목록을 불러오지 못했습니다.');
    }

    return body?.comments ?? [];
};

export default function CommentSection({ bgColor = 'white' }: CommentSectionProps) {
    const [comments, setComments] = useState<GuestComment[]>([]);
    const [author, setAuthor] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [activeAction, setActiveAction] = useState<CommentAction>(null);
    const [actionPassword, setActionPassword] = useState('');
    const [editMessage, setEditMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [listError, setListError] = useState('');
    const [actionError, setActionError] = useState('');

    const loadComments = useCallback(async () => {
        setIsLoading(true);
        setListError('');

        try {
            const nextComments = await fetchComments();

            setComments(nextComments);
        } catch (error) {
            setListError(error instanceof Error ? error.message : '댓글 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadInitialComments = async () => {
            try {
                const nextComments = await fetchComments();

                if (!isMounted) return;

                setComments(nextComments);
            } catch (error) {
                if (isMounted) {
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

    const resetForm = () => {
        setAuthor('');
        setPassword('');
        setMessage('');
        setFormError('');
    };

    const resetAction = () => {
        setActiveAction(null);
        setActionPassword('');
        setEditMessage('');
        setActionError('');
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
            const body = await getResponseBody(response);

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? '댓글을 등록하지 못했습니다.');
            }

            setComments((currentComments) => [body.comment as GuestComment, ...currentComments]);
            resetForm();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : '댓글을 등록하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAction = (comment: GuestComment, mode: 'edit' | 'delete') => {
        setActiveAction({ id: comment.id, mode });
        setActionPassword('');
        setEditMessage(comment.message);
        setActionError('');
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
            const body = await getResponseBody(response);

            if (!response.ok || !body?.comment) {
                throw new Error(body?.error ?? '댓글을 수정하지 못했습니다.');
            }

            setComments((currentComments) =>
                currentComments.map((comment) => (comment.id === activeAction.id ? (body.comment as GuestComment) : comment)),
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
            const body = await getResponseBody(response);

            if (!response.ok) {
                throw new Error(body?.error ?? '댓글을 삭제하지 못했습니다.');
            }

            setComments((currentComments) => currentComments.filter((comment) => comment.id !== activeAction.id));
            resetAction();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.');
        } finally {
            setIsActionSubmitting(false);
        }
    };

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
                    <CommentCount>방명록 {comments.length}개</CommentCount>
                    <RefreshButton type="button" onClick={loadComments} disabled={isLoading}>
                        새로고침
                    </RefreshButton>
                </CommentToolbar>

                <CommentList>
                    {isLoading && <StateMessage>댓글을 불러오는 중입니다.</StateMessage>}
                    {!isLoading && listError && <StateMessage role="alert">{listError}</StateMessage>}
                    {!isLoading && !listError && comments.length === 0 && <StateMessage>아직 남겨진 메시지가 없습니다.</StateMessage>}

                    {!isLoading &&
                        !listError &&
                        comments.map((comment) => {
                            const isActive = activeAction?.id === comment.id;

                            return (
                                <CommentItem key={comment.id}>
                                    <CommentHeader>
                                        <CommentAuthor>{comment.author}</CommentAuthor>
                                        <CommentDate dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</CommentDate>
                                    </CommentHeader>
                                    <CommentMessage>{comment.message}</CommentMessage>

                                    <CommentActions>
                                        <TextButton type="button" onClick={() => openAction(comment, 'edit')} disabled={isActionSubmitting}>
                                            수정
                                        </TextButton>
                                        <TextButton type="button" onClick={() => openAction(comment, 'delete')} disabled={isActionSubmitting}>
                                            삭제
                                        </TextButton>
                                    </CommentActions>

                                    {isActive && (
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
                                    )}
                                </CommentItem>
                            );
                        })}
                </CommentList>
            </CommentLayout>
        </CommentSectionContainer>
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
    max-width: 40rem;
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
    font-size: 0.92rem;
    box-sizing: border-box;
`;

const MessageInput = styled.textarea`
    ${inputBaseStyles}
    min-height: 7.5rem;
    resize: vertical;
    padding: 0.85rem;
    font-size: 0.95rem;
    line-height: 1.7;
    box-sizing: border-box;
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

const CommentHeader = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: baseline;
    margin-bottom: 0.6rem;

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

const CommentActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 0.8rem;
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
    font-size: 0.88rem;
    box-sizing: border-box;
`;

const PanelTextarea = styled.textarea`
    ${inputBaseStyles}
    min-height: 5.5rem;
    resize: vertical;
    padding: 0.75rem;
    font-size: 0.9rem;
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
