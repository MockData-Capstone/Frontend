// 카카오맵 JavaScript SDK v2 중 이 앱에서 쓰는 부분만 선언한다.
declare namespace kakao.maps {
  function load(callback: () => void): void;

  class LatLng {
    constructor(latitude: number, longitude: number);
    getLat(): number;
    getLng(): number;
  }

  // 지도 위에 겹치는 타일 (경사도 = 지형도, 로드뷰 = 로드뷰가 있는 길 표시)
  enum MapTypeId {
    ROADMAP = 1,
    SKYVIEW = 2,
    HYBRID = 3,
    ROADVIEW = 5,
    TERRAIN = 7,
  }

  // 지도 'click'은 { latLng }을 넘기고, 로드뷰 'init'·'position_changed'·'viewpoint_changed'는 인자가 없다.
  namespace event {
    function addListener(target: unknown, type: string, handler: (...args: never[]) => void): void;
    function removeListener(target: unknown, type: string, handler: (...args: never[]) => void): void;
  }

  interface Viewpoint {
    // 방위각(도, 북쪽 0 · 시계 방향), 위아래 각도, 확대 단계
    pan: number;
    tilt: number;
    zoom: number;
  }

  class Roadview {
    constructor(container: HTMLElement);
    setPanoId(panoId: number, position: LatLng): void;
    getPosition(): LatLng;
    getViewpoint(): Viewpoint;
    setViewpoint(viewpoint: Viewpoint): void;
    relayout(): void;
  }

  class RoadviewClient {
    constructor();
    getNearestPanoId(position: LatLng, radius: number, callback: (panoId: number | null) => void): void;
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
  }

  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level?: number });
    setCenter(latlng: LatLng): void;
    panTo(latlng: LatLng): void;
    // 지도 중심을 픽셀만큼 옮긴다 (+x 동쪽, +y 남쪽)
    panBy(dx: number, dy: number): void;
    getLevel(): number;
    setLevel(level: number, options?: { animate?: boolean }): void;
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void;
    addOverlayMapTypeId(id: MapTypeId): void;
    removeOverlayMapTypeId(id: MapTypeId): void;
    relayout(): void;
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
    setPosition(position: LatLng): void;
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
    // 카테고리 그룹 코드 (SW8 지하철역, SC4 학교 …). 그룹이 없는 장소는 빈 문자열
    category_group_code: string;
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

  interface AddressSearchResultItem {
    address_name: string;
    // REGION: 지역명(시·군·구·동)만 맞은 결과. 나머지는 도로명·지번 주소다.
    address_type: 'REGION' | 'ROAD' | 'REGION_ADDR' | 'ROAD_ADDR';
    x: string;
    y: string;
  }

  class Geocoder {
    constructor();
    addressSearch(
      address: string,
      callback: (result: AddressSearchResultItem[], status: Status) => void,
    ): void;
  }
}

interface Window {
  kakao?: typeof kakao;
}
