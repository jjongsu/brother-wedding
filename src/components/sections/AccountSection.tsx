'use client';

import { useState } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { weddingConfig } from '@config/wedding-config';

type AccountPerson = 'groom' | 'bride' | 'groomFather' | 'groomMother' | 'brideFather' | 'brideMother';
type AccountSide = 'groom' | 'bride';

interface AccountInfo {
    bank: string;
    number: string;
    holder: string;
    kakaopay?: string;
}

type AccountSectionProps = BaseComponentProps;

const AccountSection = ({ bgColor = 'white' }: AccountSectionProps) => {
    const [copyStatus, setCopyStatus] = useState<Record<AccountPerson, boolean>>({
        groom: false,
        bride: false,
        groomFather: false,
        groomMother: false,
        brideFather: false,
        brideMother: false,
    });

    // URL 복사 상태 관리
    const [urlCopied, setUrlCopied] = useState(false);

    // 계좌 그룹 열림/닫힘 상태 관리
    const [expandedSide, setExpandedSide] = useState<AccountSide | null>(null);

    const toggleSide = (side: AccountSide) => {
        if (expandedSide === side) {
            setExpandedSide(null);
        } else {
            setExpandedSide(side);
        }
    };

    const copyToClipboard = (text: string, person: AccountPerson) => {
        navigator.clipboard.writeText(text).then(
            () => {
                setCopyStatus({ ...copyStatus, [person]: true });
                setTimeout(() => {
                    setCopyStatus({ ...copyStatus, [person]: false });
                }, 2000);
            },
            (err) => {
                console.error('계좌번호 복사 실패:', err);
            },
        );
    };

    // URL 복사 함수
    const copyWebsiteUrl = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(
            () => {
                setUrlCopied(true);
                setTimeout(() => {
                    setUrlCopied(false);
                }, 2000);
            },
            (err) => {
                console.error('URL 복사 실패:', err);
            },
        );
    };

    // 웹 공유 API를 사용한 공유 함수
    const shareWebsite = async () => {
        const shareData = {
            title: weddingConfig.meta.title,
            text: `${weddingConfig.invitation.groom.name} ♥ ${weddingConfig.invitation.bride.name}의 결혼식에 초대합니다\n${window.location.href}`,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // 공유 API를 지원하지 않는 경우 URL 복사로 대체
                copyWebsiteUrl();
                alert('이 브라우저는 공유 기능을 지원하지 않습니다. URL이 복사되었습니다.');
            }
        } catch (error) {
            console.error('공유 실패:', error);
        }
    };

    // 각 인물에 해당하는 이름 가져오기
    const getPersonName = (person: AccountPerson): string => {
        switch (person) {
            case 'groom':
                return weddingConfig.invitation.groom.name;
            case 'bride':
                return weddingConfig.invitation.bride.name;
            case 'groomFather':
                return weddingConfig.invitation.groom.father;
            case 'groomMother':
                return weddingConfig.invitation.groom.mother;
            case 'brideFather':
                return weddingConfig.invitation.bride.father;
            case 'brideMother':
                return weddingConfig.invitation.bride.mother;
            default:
                return '';
        }
    };

    // 개별 계좌 정보 행 렌더링
    const renderAccountRow = (accountInfo: AccountInfo, person: AccountPerson, title: string) => {
        // 계좌 소유자 이름이 비어있는 경우 null 반환하여 렌더링하지 않음
        const personName = getPersonName(person);
        if (!personName || personName.trim() === '') {
            return null;
        }

        // 1줄: 은행명, 2줄: 계좌번호 + 예금주
        const bankText = accountInfo.bank;
        const numberAndHolder = `${accountInfo.number} ${accountInfo.holder}`;

        // 복사할 텍스트: '은행명 계좌번호 (예금주)'
        const copyText = `${accountInfo.bank} ${accountInfo.number} ${accountInfo.holder}`;

        return (
            <AccountRow>
                <AccountRowTitle>{title}</AccountRowTitle>
                <AccountRowInfo>
                    <AccountBank>{bankText}</AccountBank>
                    <AccountNumber>{numberAndHolder}</AccountNumber>
                </AccountRowInfo>
                <AccountActions>
                    {accountInfo.kakaopay && (
                        <KakaoPayLink
                            href={accountInfo.kakaopay}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${accountInfo.holder}에게 카카오페이로 송금하기`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image src="/images/kakap-pay/btn_send_tiny.png" alt="카카오페이 송금" width={140} height={32} />
                        </KakaoPayLink>
                    )}
                    <CopyButton
                        onClick={(e) => {
                            e.stopPropagation(); // 클릭 이벤트가 상위로 전파되지 않도록 방지
                            copyToClipboard(copyText, person);
                        }}
                    >
                        {copyStatus[person] ? '복사 완료' : '복사'}
                    </CopyButton>
                </AccountActions>
            </AccountRow>
        );
    };

    return (
        <AccountSectionContainer $bgColor={bgColor}>
            <SectionTitle>마음 전하실 곳</SectionTitle>

            <AccountCards>
                {/* 신랑측 계좌 카드 */}
                <AccountCard onClick={() => toggleSide('groom')}>
                    <AccountCardHeader $isExpanded={expandedSide === 'groom'}>
                        <GroupTitle>신랑 측 계좌번호</GroupTitle>
                        <ExpandIcon $isExpanded={expandedSide === 'groom'}>{expandedSide === 'groom' ? '−' : '+'}</ExpandIcon>
                    </AccountCardHeader>

                    {expandedSide === 'groom' && (
                        <AccountRowsContainer>
                            {renderAccountRow(weddingConfig.account.groom, 'groom', '신랑')}
                            {renderAccountRow(weddingConfig.account.groomFather, 'groomFather', '아버지')}
                            {renderAccountRow(weddingConfig.account.groomMother, 'groomMother', '어머니')}
                        </AccountRowsContainer>
                    )}
                </AccountCard>

                {/* 신부측 계좌 카드 */}
                <AccountCard onClick={() => toggleSide('bride')}>
                    <AccountCardHeader $isExpanded={expandedSide === 'bride'}>
                        <GroupTitle>신부 측 계좌번호</GroupTitle>
                        <ExpandIcon $isExpanded={expandedSide === 'bride'}>{expandedSide === 'bride' ? '−' : '+'}</ExpandIcon>
                    </AccountCardHeader>

                    {expandedSide === 'bride' && (
                        <AccountRowsContainer>
                            {renderAccountRow(weddingConfig.account.bride, 'bride', '신부')}
                            {/* {renderAccountRow(weddingConfig.account.brideFather, 'brideFather', '아버지')} */}
                            {/* {renderAccountRow(weddingConfig.account.brideMother, 'brideMother', '어머니')} */}
                        </AccountRowsContainer>
                    )}
                </AccountCard>
            </AccountCards>

            {/* 청첩장 공유하기 버튼 */}
            <ShareContainer>
                <ShareButton onClick={copyWebsiteUrl}>{urlCopied ? '복사 완료!' : 'URL 복사하기'}</ShareButton>
                <ShareButton onClick={shareWebsite} $isShare={true}>
                    공유하기
                </ShareButton>
            </ShareContainer>
        </AccountSectionContainer>
    );
};

const AccountSectionContainer = styled.section<{ $bgColor: 'white' | 'beige' }>`
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

const AccountCards = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 40rem;
    margin: 0 auto;
`;

const AccountCard = styled.div`
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        box-shadow: 0 6px 10px rgba(0, 0, 0, 0.1);
    }
`;

const AccountCardHeader = styled.div<{ $isExpanded: boolean }>`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    border-bottom: ${(props) => (props.$isExpanded ? '1px solid #eee' : 'none')};
`;

const GroupTitle = styled.h3`
    font-weight: 400;
    font-size: 1rem;
    color: #333;
    margin: 0;
    text-align: left;
    letter-spacing: 0.02em;
`;

const ExpandIcon = styled.span<{ $isExpanded: boolean }>`
    font-size: 1.5rem;
    line-height: 1;
    color: var(--secondary-color);
    transition: transform 0.3s ease;
    transform: ${(props) => (props.$isExpanded ? 'rotate(0deg)' : 'rotate(0deg)')};
`;

const AccountRowsContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const AccountRow = styled.div`
    display: grid;
    grid-template-columns: minmax(5.5rem, auto) minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f5f5f5;

    &:last-child {
        border-bottom: none;
    }

    @media (max-width: 580px) {
        grid-template-columns: 4.25rem minmax(0, 1fr) auto;
        padding: 1rem 1rem;
    }

    @media (max-width: 480px) {
        grid-template-columns: 3.5rem minmax(0, 1fr);
        align-items: center;
        row-gap: 0.7rem;
        padding: 1rem 0.75rem;
    }

    @media (max-width: 380px) {
        grid-template-columns: 3.25rem minmax(0, 1fr);
        padding: 1rem 0.55rem;
    }
`;

const AccountRowTitle = styled.div`
    font-weight: 500;
    font-size: 0.95rem;
    color: var(--secondary-color);
    text-align: left;

    @media (max-width: 480px) {
        align-self: start;
        padding-top: 0.1rem;
    }
`;

const AccountRowInfo = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    align-items: flex-start;
    gap: 0.1rem;
    min-width: 0;
`;

const AccountBank = styled.div`
    font-size: 0.95rem;
    color: var(--text-medium);
    white-space: nowrap;
    font-size: 0.85rem;
    line-height: 1.3;
    @media (max-width: 580px) {
        font-size: 0.75rem;
    }
`;

const AccountNumber = styled.div`
    font-weight: 500;
    font-size: clamp(0.7rem, 4vw, 1.1rem);
    color: var(--text-dark);
    font-size: 0.95rem;
    line-height: 1.3;
    word-break: break-all;
    @media (max-width: 580px) {
        font-size: 0.85rem;
    }
`;

const AccountActions = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
    flex-shrink: 0;

    @media (max-width: 480px) {
        grid-column: 2;
        justify-content: flex-end;
        width: 100%;
    }
`;

const KakaoPayLink = styled.a`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 5.8rem;
    height: 2rem;
    border-radius: 4px;
    background-color: #ffeb00;
    box-shadow: 0 1px 2px rgba(58, 29, 29, 0.12);
    overflow: hidden;
    transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        filter 0.2s ease;

    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    &:hover {
        box-shadow: 0 3px 8px rgba(58, 29, 29, 0.16);
        filter: saturate(1.04);
    }

    &:active {
        transform: translateY(1px);
    }

    @media (max-width: 380px) {
        width: 5.35rem;
    }
`;

const CopyButton = styled.button`
    background-color: transparent;
    border: 1px solid var(--secondary-color);
    color: var(--secondary-color);
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    min-height: 2rem;

    &:hover,
    &:active {
        background-color: var(--secondary-color);
        color: white;
    }

    &:active {
        transform: translateY(1px);
    }

    &:after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 5px;
        height: 5px;
        background: rgba(255, 255, 255, 0.5);
        opacity: 0;
        border-radius: 100%;
        transform: scale(1, 1) translate(-50%);
        transform-origin: 50% 50%;
    }

    &:active:after {
        animation: ripple 0.6s ease-out;
    }

    @keyframes ripple {
        0% {
            transform: scale(0, 0);
            opacity: 0.5;
        }
        20% {
            transform: scale(25, 25);
            opacity: 0.3;
        }
        100% {
            opacity: 0;
            transform: scale(40, 40);
        }
    }
`;

const ShareContainer = styled.div`
    margin-top: 2rem;
    display: flex;
    justify-content: center;
    gap: 1rem;
`;

const ShareButton = styled.button<{ $isShare?: boolean }>`
    background-color: var(--secondary-color);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    flex: 1;
    max-width: 180px;

    &:hover {
        background-color: #c4a986;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    }

    &:active {
        transform: translateY(1px);
    }

    &:after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 5px;
        height: 5px;
        background: rgba(255, 255, 255, 0.5);
        opacity: 0;
        border-radius: 100%;
        transform: scale(1, 1) translate(-50%);
        transform-origin: 50% 50%;
    }

    &:active:after {
        animation: ripple 0.6s ease-out;
    }
`;

export default AccountSection;
