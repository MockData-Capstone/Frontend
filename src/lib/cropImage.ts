// AUTH-05 프로필 사진 자르기: react-easy-crop이 알려주는 영역(원본 이미지 픽셀)을 잘라 정사각형 이미지로 만든다.

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  size: number;
}

// 업로드할 사진 크기와 화질. 아바타는 원형으로 보이므로 정사각형 하나면 충분하다.
export const PROFILE_OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.9;

// 소수점 영역을 원본 안에 들어가는 정수 정사각형으로 맞춘다.
// 확대·이동 중 계산 오차로 영역이 원본 밖으로 조금 나가도 잘리는 곳 없이 안쪽으로 당긴다.
export function toCropRect(area: CropArea, imageWidth: number, imageHeight: number): CropRect {
  const maxSize = Math.max(1, Math.floor(Math.min(imageWidth, imageHeight)));
  const size = Math.min(maxSize, Math.max(1, Math.round(Math.min(area.width, area.height))));
  const clamp = (value: number, limit: number) => Math.min(Math.max(0, Math.round(value)), Math.max(0, Math.floor(limit) - size));
  return { x: clamp(area.x, imageWidth), y: clamp(area.y, imageHeight), size };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('사진을 불러오지 못했어요.'));
    image.src = src;
  });
}

// 고른 영역을 PROFILE_OUTPUT_SIZE 정사각형 JPEG로 만든다. 투명한 PNG는 흰 배경으로 채운다.
export async function cropToBlob(imageSrc: string, area: CropArea, outputSize = PROFILE_OUTPUT_SIZE): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const rect = toCropRect(area, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('사진을 자르지 못했어요.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputSize, outputSize);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, outputSize, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('사진을 자르지 못했어요.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
