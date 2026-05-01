'use client';

import { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Image from 'next/image';
import { weddingConfig } from '@config/wedding-config';

type GallerySectionProps = BaseComponentProps;

// 로딩 스피너 컴포넌트 추가
const LoadingSpinner = styled.div`
    width: 3rem;
    height: 3rem;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
`;

const GallerySection = ({ bgColor = 'white' }: GallerySectionProps) => {
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [expandedImageIndex, setExpandedImageIndex] = useState<number>(-1);
    const [isExpandedImageLoading, setIsExpandedImageLoading] = useState<boolean>(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const images = weddingConfig.gallery.images;

    // 브라우저 뒤로가기 처리
    useEffect(() => {
        if (expandedImage) {
            // 이미지가 확대되었을 때 히스토리 항목 추가
            window.history.pushState({ expandedImage: true }, '');

            // 뒤로가기 이벤트 리스너 추가
            const handlePopState = (event: PopStateEvent) => {
                if (expandedImage) {
                    setExpandedImage(null);
                    document.body.style.overflow = '';
                    event.preventDefault();
                }
            };

            window.addEventListener('popstate', handlePopState);

            // 컴포넌트 언마운트 시 리스너 제거
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [expandedImage]);

    const handleImageClick = (image: string) => {
        const imageIndex = images.indexOf(image);
        setExpandedImage(image);
        setExpandedImageIndex(imageIndex);
        setIsExpandedImageLoading(true); // 이미지 로딩 시작
    };

    const goToPreviousImage = () => {
        if (expandedImageIndex > 0) {
            const newIndex = expandedImageIndex - 1;
            setExpandedImageIndex(newIndex);
            setExpandedImage(images[newIndex]);
            setIsExpandedImageLoading(true); // 새 이미지 로딩 시작
        }
    };

    const goToNextImage = () => {
        if (expandedImageIndex < images.length - 1) {
            const newIndex = expandedImageIndex + 1;
            setExpandedImageIndex(newIndex);
            setExpandedImage(images[newIndex]);
            setIsExpandedImageLoading(true); // 새 이미지 로딩 시작
        }
    };

    const handleCloseExpanded = () => {
        setExpandedImage(null);
        setExpandedImageIndex(-1);
        setIsExpandedImageLoading(false); // 로딩 상태 리셋
        // 확대 이미지가 닫힐 때 스크롤 허용
        document.body.style.overflow = '';
        // 뒤로가기 히스토리 처리
        if (window.history.state && window.history.state.expandedImage) {
            window.history.back();
        }
    };

    // 터치 이벤트 처리
    useEffect(() => {
        let startX = 0;
        let startY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // 수평 스와이프가 수직 스와이프보다 클 때만 이미지 변경
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    // 오른쪽 스와이프 - 이전 이미지
                    goToPreviousImage();
                } else {
                    // 왼쪽 스와이프 - 다음 이미지
                    goToNextImage();
                }
            }
        };

        if (expandedImage && overlayRef.current) {
            const overlay = overlayRef.current;
            overlay.addEventListener('touchstart', handleTouchStart, { passive: true });
            overlay.addEventListener('touchend', handleTouchEnd, { passive: true });

            return () => {
                overlay.removeEventListener('touchstart', handleTouchStart);
                overlay.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [expandedImage]);

    // 키보드 이벤트 처리
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (expandedImage) {
                switch (event.key) {
                    case 'ArrowLeft':
                        event.preventDefault();
                        goToPreviousImage();
                        break;
                    case 'ArrowRight':
                        event.preventDefault();
                        goToNextImage();
                        break;
                    case 'Escape':
                        event.preventDefault();
                        handleCloseExpanded();
                        break;
                }
            }
        };

        const handleWheel = (event: WheelEvent) => {
            if (expandedImage) {
                event.preventDefault();
                if (event.deltaY > 0) {
                    // 아래로 스크롤 - 다음 이미지
                    goToNextImage();
                } else {
                    // 위로 스크롤 - 이전 이미지
                    goToPreviousImage();
                }
            }
        };

        if (expandedImage) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('wheel', handleWheel, { passive: false });
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('wheel', handleWheel);
            };
        }
    }, [expandedImage, expandedImageIndex, images]);

    useEffect(() => {
        if (expandedImage) {
            // 확대 이미지가 표시될 때 스크롤 방지
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }, [expandedImage]);

    // 확대된 이미지 로드 완료 핸들러
    const handleExpandedImageLoad = () => {
        setIsExpandedImageLoading(false);
    };

    // 확대된 이미지 로드 에러 핸들러
    const handleExpandedImageError = () => {
        setIsExpandedImageLoading(false);
    };

    if (images.length === 0) {
        return (
            <GallerySectionContainer $bgColor={bgColor}>
                <SectionTitle>갤러리</SectionTitle>
                <ErrorContainer>갤러리 이미지가 없습니다</ErrorContainer>
            </GallerySectionContainer>
        );
    }

    return (
        <GallerySectionContainer $bgColor={bgColor}>
            <SectionTitle>갤러리</SectionTitle>

            <GalleryGridContainer>
                {images.map((image, index) => (
                    <GalleryGridCard key={index} onClick={() => handleImageClick(image)}>
                        <GalleryGridImageWrapper>
                            <GalleryNextImage
                                src={image}
                                alt={`웨딩 갤러리 이미지 ${index + 1}`}
                                fill
                                sizes="(max-width: 768px) calc(33.333vw - 1rem), calc(33.333vw - 2rem)"
                                quality={85}
                                priority={index < 6}
                                style={{ objectFit: 'cover' }}
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                            />
                        </GalleryGridImageWrapper>
                    </GalleryGridCard>
                ))}
            </GalleryGridContainer>

            {expandedImage && (
                <ExpandedImageOverlay ref={overlayRef} onClick={handleCloseExpanded} aria-modal="true" role="dialog">
                    <ExpandedImageContainer onClick={(e) => e.stopPropagation()}>
                        {isExpandedImageLoading && (
                            <LoadingSpinnerContainer>
                                <LoadingSpinner />
                            </LoadingSpinnerContainer>
                        )}
                        <ExpandedImageWrapper $isLoading={isExpandedImageLoading}>
                            <Image
                                src={expandedImage}
                                alt="확대된 웨딩 갤러리 이미지"
                                fill
                                sizes="90vw"
                                quality={90}
                                style={{ objectFit: 'contain', background: 'transparent' }}
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                onLoad={handleExpandedImageLoad}
                                onError={handleExpandedImageError}
                            />
                        </ExpandedImageWrapper>
                        <CloseButton onClick={handleCloseExpanded} aria-label="닫기">
                            ×
                        </CloseButton>
                    </ExpandedImageContainer>
                </ExpandedImageOverlay>
            )}
        </GallerySectionContainer>
    );
};

const GallerySectionContainer = styled.section<{ $bgColor: 'white' | 'beige' }>`
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

const GalleryNextImage = styled(Image)`
    border-radius: 8px;
    transition: transform 0.3s;

    &:hover {
        transform: scale(1.05);
    }
`;

const ExpandedImageOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ExpandedImageContainer = styled.div`
    position: relative;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    background-color: transparent;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ExpandedImageWrapper = styled.div<{ $isLoading: boolean }>`
    position: relative;
    width: 90vw;
    height: 90vh;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: ${({ $isLoading }) => ($isLoading ? 0.5 : 1)};
    transition: opacity 0.3s ease;
`;

const CloseButton = styled.button`
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2.5rem;
    height: 2.5rem;
    background-color: var(--secondary-color);
    color: white;
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 10;
    opacity: 0.9;

    &:hover {
        opacity: 1;
    }
`;

const LoadingContainer = styled.div`
    padding: 3rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    max-width: 36rem;
    margin: 0 auto;
`;

const ErrorContainer = styled.div`
    padding: 3rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    max-width: 36rem;
    margin: 0 auto;
    color: #c62828;
`;

const LoadingSpinnerContainer = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
`;

const GalleryGridContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    max-width: 800px;
    margin: 2rem auto 0;
    padding: 0 1rem;

    @media (max-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        padding: 0 0.5rem;
        margin-top: 1.5rem;
    }
`;

const GalleryGridCard = styled.div`
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    transition: transform 0.3s ease;
    cursor: pointer;
    position: relative;
    width: 100%;

    &:hover {
        transform: translateY(-5px);
    }
`;

const GalleryGridImageWrapper = styled.div`
    position: relative;
    width: 100%;
    padding-bottom: 100%; /* 1:1 비율 (정사각형) */
`;

export default GallerySection;
