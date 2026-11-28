import { useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import Dialog from '../Dialog';
import type { CropArea } from '../../lib/cropImage';
import './ProfileCropDialog.css';

// AUTH-05 프로필 사진 자르기 팝업: 드래그로 위치, 막대·휠·두 손가락으로 크기를 맞추고 원 안의 영역만 올린다.
// 팝업은 고른 영역만 알려주고, 자르기와 업로드는 연 화면(내 정보)이 맡는다.
interface ProfileCropDialogProps {
  imageSrc: string | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: (area: CropArea) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

// 원 바깥은 어둡게 덮지 않고 화면 바탕색으로 흐리게 덮어 밝은 화면과 어울리게 한다
const CROP_AREA_STYLE = {
  border: '2px solid #ffffff',
  boxShadow: '0 0 0 9999em rgba(247, 247, 245, 0.78)',
};

export default function ProfileCropDialog({ imageSrc, ...rest }: ProfileCropDialogProps) {
  if (!imageSrc) return null;
  // 다른 사진을 고르면 key가 바뀌어 위치·크기가 처음 상태로 돌아간다
  return <CropDialog key={imageSrc} imageSrc={imageSrc} {...rest} />;
}

function CropDialog({
  imageSrc,
  busy = false,
  error,
  onConfirm,
  onClose,
}: Omit<ProfileCropDialogProps, 'imageSrc'> & { imageSrc: string }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <Dialog
      open
      title="프로필 사진 영역 선택"
      description="사진을 끌어 위치를 옮기고, 크기를 맞춰주세요."
      confirmLabel="적용하기"
      busyLabel="올리는 중"
      busy={busy}
      confirmDisabled={!area}
      onConfirm={() => {
        if (area) onConfirm(area);
      }}
      onClose={onClose}
    >
      <div className="profile-crop">
        <div className="profile-crop__stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={1}
            cropShape="round"
            showGrid={false}
            style={{ cropAreaStyle: CROP_AREA_STYLE }}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="profile-crop__zoom">
          <button
            type="button"
            className="profile-crop__zoom-button"
            aria-label="축소"
            disabled={busy || zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
          >
            −
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={busy}
            aria-label="사진 크기"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <button
            type="button"
            className="profile-crop__zoom-button"
            aria-label="확대"
            disabled={busy || zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
          >
            +
          </button>
        </div>
        <p className="profile-crop__hint">원 안에 보이는 부분이 프로필 사진이 돼요.</p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
