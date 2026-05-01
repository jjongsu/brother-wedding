// type NaverLatLng = object;

// interface NaverMap {
//     setCenter(location: NaverLatLng): void;
// }

// type NaverMarker = object;

// interface NaverInfoWindow {
//     open(map: NaverMap, marker: NaverMarker): void;
// }

// interface NaverMaps {
//     LatLng: new (latitude: number, longitude: number) => NaverLatLng;
//     Map: new (
//         element: HTMLElement,
//         options: {
//             center: NaverLatLng;
//             zoom: number;
//             zoomControl: boolean;
//             zoomControlOptions: {
//                 position: unknown;
//             };
//         },
//     ) => NaverMap;
//     Marker: new (options: { position: NaverLatLng; map: NaverMap }) => NaverMarker;
//     InfoWindow: new (options: { content: string }) => NaverInfoWindow;
//     Position: {
//         RIGHT_TOP: unknown;
//     };
// }

// interface Window {
//     naver?: {
//         maps?: NaverMaps;
//     };
// }

interface BaseComponentProps {
    bgColor?: 'white' | 'beige';
}
