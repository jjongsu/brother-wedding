'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import MainSection from '@component/sections/MainSection';

// 동적 임포트로 코드 분할 및 지연 로딩 적용
const DateSection = dynamic(() => import('@component/sections/DateSection'), {
    loading: () => <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>로딩 중...</div>,
});

// // 카카오맵 API는 클라이언트 사이드에서만 로드되어야 함
const VenueSection = dynamic(() => import('@component/sections/VenueSection'), {
    ssr: false,
    loading: () => <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>로딩 중...</div>,
});

const GallerySection = dynamic(() => import('@component/sections/GallerySection'), {
    loading: () => <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>로딩 중...</div>,
});

const InvitationSection = dynamic(() => import('@component/sections/InvitationSection'));
const AccountSection = dynamic(() => import('@component/sections/AccountSection'));

const CommentSection = dynamic(() => import('@component/sections/CommentSection'), {
    loading: () => <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>로딩 중...</div>,
});

export default function Home() {
    // 실제 렌더링되는 섹션들의 순서를 계산하여 색상 인덱스 결정
    const sectionColorMap = useMemo(() => {
        const sections = [];

        // MainSection은 색상 계산에서 제외 (항상 기본 스타일)
        sections.push('invitation'); // InvitationSection
        sections.push('date'); // DateSection
        sections.push('venue'); // VenueSection

        sections.push('account'); // AccountSection
        sections.push('gallery-bottom'); // GallerySection (bottom)
        sections.push('comment'); // CommentSection

        // 각 섹션에 색상 인덱스 할당 (0부터 시작하여 번갈아가며)
        const colorMap: Record<string, 'white' | 'beige'> = {};
        sections.forEach((section, index) => {
            colorMap[section] = index % 2 === 0 ? 'white' : 'beige';
        });

        return colorMap;
    }, []);

    return (
        <main>
            <MainSection />
            <InvitationSection bgColor={sectionColorMap['invitation']} />
            <DateSection bgColor={sectionColorMap['date']} />
            <VenueSection bgColor={sectionColorMap['venue']} />
            <AccountSection bgColor={sectionColorMap['account']} />
            <GallerySection bgColor={sectionColorMap['gallery-bottom']} />
            <CommentSection bgColor={sectionColorMap['comment']} />
        </main>
    );
}
