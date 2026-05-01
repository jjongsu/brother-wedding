export {};

declare global {
    interface Window {
        naver: {
            maps: {
                LatLng: new (lat: number, lng: number) => NaverLatLng;
                Map: new (mapDiv: string | HTMLElement, options?: NaverMapOptions) => NaverMap;
                Marker: new (options: NaverMarkerOptions) => NaverMarker;
                InfoWindow: new (options?: NaverInfoWindowOptions) => NaverInfoWindow;
                Position: {
                    TOP_LEFT: string | number;
                    TOP_CENTER: string | number;
                    TOP_RIGHT: string | number;
                    LEFT_TOP: string | number;
                    RIGHT_TOP: string | number;
                    LEFT_CENTER: string | number;
                    RIGHT_CENTER: string | number;
                    LEFT_BOTTOM: string | number;
                    RIGHT_BOTTOM: string | number;
                    BOTTOM_LEFT: string | number;
                    BOTTOM_CENTER: string | number;
                    BOTTOM_RIGHT: string | number;
                };
                Event: {
                    addListener(target: NaverMap | NaverMarker, eventName: string, listener: (...args: unknown[]) => void): unknown;
                };
            };
        };
    }

    interface NaverLatLng {
        lat(): number;
        lng(): number;
    }

    interface NaverMapOptions {
        center?: NaverLatLng;
        zoom?: number;
        zoomControl?: boolean;
        zoomControlOptions?: NaverZoomControlOptions;
    }

    interface NaverZoomControlOptions {
        position?: string | number;
    }

    interface NaverMap {
        setCenter(latlng: NaverLatLng): void;
        setZoom(zoom: number): void;
    }

    interface NaverMarkerOptions {
        position: NaverLatLng;
        map?: NaverMap;
    }

    interface NaverMarker {
        setMap(map: NaverMap | null): void;
        getPosition(): NaverLatLng;
    }

    interface NaverInfoWindowOptions {
        content?: string | HTMLElement;
    }

    interface NaverInfoWindow {
        open(map: NaverMap, anchor?: NaverMarker): void;
        close(): void;
        getMap(): NaverMap | null;
        setContent(content: string | HTMLElement): void;
    }
}
