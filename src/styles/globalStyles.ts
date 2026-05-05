'use client';

import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  /* 폰트 로딩 전에 적용될 스타일 */
  @font-face {
    font-family: 'MaruBuri';
    src: url('/fonts/MaruBuri-ExtraLight.ttf') format('truetype');
    font-weight: 200;
    font-style: normal;
    font-display: block; /* 폰트 로딩될 때까지 텍스트를 보이지 않게 함 */
  }
  
  @font-face {
    font-family: 'MaruBuri';
    src: url('/fonts/MaruBuri-Light.ttf') format('truetype');
    font-weight: 300;
    font-style: normal;
    font-display: block;
  }
  
  @font-face {
    font-family: 'MaruBuri';
    src: url('/fonts/MaruBuri-Regular.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }
  
  @font-face {
    font-family: 'MaruBuri';
    src: url('/fonts/MaruBuri-SemiBold.ttf') format('truetype');
    font-weight: 600;
    font-style: normal;
    font-display: block;
  }
  
  @font-face {
    font-family: 'MaruBuri';
    src: url('/fonts/MaruBuri-Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: 'PlayfairDisplay';
    src: url('/fonts/PlayfairDisplay-Italic.ttf') format('truetype');
    font-weight: normal;
    font-style: italic;
    font-display: block;
  }
  
  /* 컨텐츠가 바로 보이지만 폰트가 로드되면 레이아웃이 바뀌는 것을 방지 */
  html, body {
    visibility: visible;
    opacity: 1;
    font-size: 16px;
    touch-action: pan-x pan-y;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }
  
  body {
    font-family: 'MaruBuri', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    color: #333333;
    margin: 0;
    padding: 0;
    line-height: 1.6;
  }

  input,
  textarea,
  select {
    font-size: 16px;
  }

  button,
  a {
    touch-action: manipulation;
  }

  body::after {
    content: "";
    position: fixed;
    bottom: -100px;
    right: -100px;
    opacity: 0.01;
    font-size: 8px;
    transform: rotate(-45deg);
    pointer-events: none;
    z-index: -1000;
    color: rgba(0, 0, 0, 0.02);
    user-select: none;
  }
  
  .wedding-container {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' opacity='0.01'%3E%3Ctext x='0' y='20' fill='rgba(0,0,0,0.03)'%3EJWK-TEMPLATE%3C/text%3E%3C/svg%3E");
  }

  :root {
    --primary-color: #F8F6F2;
    --secondary-color: #D4B996; 
    --text-dark: #333333;
    --text-medium: #666666;
    --text-light: #999999;
  }
`;
