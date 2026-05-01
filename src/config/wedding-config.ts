interface GalleryConfig {
    images: string[];
}

export const weddingConfig = {
    // 메타 정보
    meta: {
        title: '종민❤️정인 결혼식에 초대합니다.',
        description: '2027. 3. 27.(일) PM 04:30\n대전 씨엘드레브',
        ogImage: '/images/main-image.png',
        noIndex: true,
    },

    // 메인 화면
    main: {
        title: 'Wedding Day',
        image: '/images/main-image.png',
        date: '2027년 3월 27일 일요일 04시 30분',
        venue: '대전 씨엘드레브',
    },

    // 소개글
    intro: {
        title: '',
        text: '서로를 바라보며 걸어온\n소중한 발걸음이\n이제 하나의 길로 이어집니다.\n\n사랑과 믿음으로\n새 가정을 이루는 저희 두 사람의\n작은 시작을 알려드립니다.',
    },

    // 결혼식 일정
    date: {
        year: 2027,
        month: 3,
        day: 27,
        hour: 4,
        minute: 30,
        displayDate: '2027.03.27 SUN PM 04:30',
    },

    // 장소 정보
    venue: {
        name: '씨엘드레브',
        address: '대전광역시 서구 계룡로 314번길 8(월평동) 씨엘드레브',
        tel: '010-7451-5692',
        naverMapId: '씨엘드레브', // 네이버 지도 검색용 장소명
        coordinates: {
            latitude: 36.34806,
            longitude: 127.38355,
        },
        placeId: '1599246173', // 네이버 지도 장소 ID
        mapZoom: '17', // 지도 줌 레벨
        mapNaverCoordinates: '14141300,4507203,15.00,0,0,0,dh', // 네이버 지도 길찾기 URL용 좌표 파라미터 (구 형식)
        transportation: {
            subway: '월평역(한국과학기술원) 2번 출구',
            bus: '간선 101, 103, 105, 107, 116, 119, 213, 312',
        },
        parking: '무료 발렛파킹 서비스 제공',
    },

    // 갤러리
    gallery: {
        images: [
            '/images/gallery/image1.png',
            '/images/gallery/image2.png',
            '/images/gallery/image3.png',
            '/images/gallery/image4.png',
            '/images/gallery/image5.png',
        ],
    } as GalleryConfig,

    // 초대의 말씀
    invitation: {
        message: '사랑과 신뢰로 한 걸음 한 걸음\n\n서로의 인생에 다가선 두 사람이\n\n이제 하나가 되어\n\n새로운 시작을 하려 합니다.\n\n',
        groom: {
            name: '황종민',
            label: '아들',
            father: '황인철',
            mother: '김옥천',
        },
        bride: {
            name: '신정민',
            label: '딸',
            father: '신00',
            mother: '000',
        },
    },

    // 계좌번호
    account: {
        groom: {
            bank: '토스뱅크',
            number: '123-456-7890',
            holder: '황종민',
            kakaopay: 'https://link.kakaopay.com/__/ZxDC9dv',
        },
        bride: {
            bank: '농협은행',
            number: '123-456-7890',
            holder: '신정민',
        },
        groomFather: {
            bank: '농협은행',
            number: '123-456-7890',
            holder: '황인철',
        },
        groomMother: {
            bank: '우체국',
            number: '123-456-7890',
            holder: '김옥천',
        },
        brideFather: {
            bank: '은행명',
            number: '123-456-7890',
            holder: '신부아버지',
        },
        brideMother: {
            bank: '은행명',
            number: '123-456-7890',
            holder: '신부어머니',
        },
    },
};
