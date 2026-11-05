// 카카오맵 JavaScript SDK v2 중 이 앱에서 쓰는 부분만 선언한다.
declare namespace kakao.maps {
  function load(callback: () => void): void;

  class LatLng {
    constructor(latitude: number, longitude: number);
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
  }

  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level?: number });
    setCenter(latlng: LatLng): void;
    getLevel(): number;
    setLevel(level: number, options?: { animate?: boolean }): void;
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void;
  }

  class CustomOverlay {
    constructor(options: {
      position: LatLng;
      content: HTMLElement | string;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
    });
    setMap(map: Map | null): void;
    setZIndex(zIndex: number): void;
  }
}

// 장소 검색 (SDK 주소에 libraries=services를 붙여야 생긴다). 첫 화면의 지역·지하철역·학교 검색에 쓴다.
declare namespace kakao.maps.services {
  // SDK의 Status 값은 문자열이다.
  type Status = 'OK' | 'ZERO_RESULT' | 'ERROR';

  interface PlacesSearchResultItem {
    id: string;
    place_name: string;
    category_group_name: string;
    address_name: string;
    road_address_name: string;
    // 경도(x)·위도(y)가 문자열로 온다.
    x: string;
    y: string;
  }

  class Places {
    constructor();
    keywordSearch(
      keyword: string,
      callback: (result: PlacesSearchResultItem[], status: Status) => void,
      options?: { size?: number; page?: number },
    ): void;
  }
}

interface Window {
  kakao?: typeof kakao;
}
