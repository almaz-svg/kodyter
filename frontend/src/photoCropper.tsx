import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Plus, RotateCw, X } from 'lucide-react';

// Width / height of the product photo everywhere it is shown: catalog card (.feat-photo), product page,
// admin preview and this frame. Keep in sync with --product-photo-aspect in styles.css and portals.css.
export const PRODUCT_PHOTO_ASPECT = 1.05;
// Category cards on the home page are 4:3 on a computer (and cropped to the centre on a phone).
export const CATEGORY_PHOTO_ASPECT = 4 / 3;
const OUTPUT_LONG_SIDE = 1200;
const MAX_ZOOM = 4;

type Props = { source: File | string; onCancel: () => void; onDone: (photo: Blob) => void; aspect?: number; hint?: string };

/** Frame a product photo before upload: drag to move, zoom, rotate and pick the frame shape. */
export function PhotoCropper({ source, onCancel, onDone, aspect = PRODUCT_PHOTO_ASPECT, hint }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [frameWidth, setFrameWidth] = useState(360);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);

  useEffect(() => {
    let current = true;
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const img = new Image();
    // Photos already in storage come from another host; the canvas needs CORS to read them back.
    if (typeof source === 'string') img.crossOrigin = 'anonymous';
    // A load that was replaced (or whose object URL was revoked) must not report an error.
    img.onload = () => { if (current) { setError(''); setImage(img); } };
    img.onerror = () => { if (current) setError('Не удалось открыть фото. Выберите файл JPEG, PNG или WebP.'); };
    img.src = url;
    return () => { current = false; if (typeof source !== 'string') URL.revokeObjectURL(url); };
  }, [source]);

  useEffect(() => {
    const measure = () => setFrameWidth(Math.min(frameRef.current?.parentElement?.clientWidth || 360, 420));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [image]);

  const turned = rotation % 180 !== 0;
  const naturalWidth = image ? (turned ? image.naturalHeight : image.naturalWidth) : 1;
  const naturalHeight = image ? (turned ? image.naturalWidth : image.naturalHeight) : 1;
  const frameHeight = frameWidth / aspect;
  // "Cover" scale: the photo always fills the whole frame, zoom only enlarges it.
  const scale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight) * zoom;
  const limit = { x: Math.max(0, (naturalWidth * scale - frameWidth) / 2), y: Math.max(0, (naturalHeight * scale - frameHeight) / 2) };
  const clamp = (next: { x: number; y: number }) => ({ x: Math.max(-limit.x, Math.min(limit.x, next.x)), y: Math.max(-limit.y, Math.min(limit.y, next.y)) });
  useEffect(() => { setOffset(current => clamp(current)); }, [zoom, rotation, frameWidth, image]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, start: offset }; };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (drag.current) setOffset(clamp({ x: drag.current.start.x + event.clientX - drag.current.x, y: drag.current.start.y + event.clientY - drag.current.y })); };
  const pointerUp = () => { drag.current = null; };
  const changeZoom = (value: number) => setZoom(Math.max(1, Math.min(MAX_ZOOM, value)));

  const save = async () => {
    if (!image) return;
    const outWidth = Math.round(aspect >= 1 ? OUTPUT_LONG_SIDE : OUTPUT_LONG_SIDE * aspect);
    const outHeight = Math.round(outWidth / aspect);
    const ratio = outWidth / frameWidth;
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext('2d');
    if (!context) { setError('Не удалось подготовить фото. Попробуйте ещё раз.'); return; }
    // JPEG has no transparency: a white background keeps transparent PNG areas from turning black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outWidth, outHeight);
    context.translate(outWidth / 2 + offset.x * ratio, outHeight / 2 + offset.y * ratio);
    context.rotate((rotation * Math.PI) / 180);
    const drawScale = scale * ratio;
    context.drawImage(image, (-image.naturalWidth * drawScale) / 2, (-image.naturalHeight * drawScale) / 2, image.naturalWidth * drawScale, image.naturalHeight * drawScale);
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) throw new Error('empty');
      onDone(blob);
    } catch {
      setError('Это фото нельзя изменить здесь. Загрузите файл заново через «Заменить фото».');
    }
  };

  // Rendered into <body>: an animated ancestor (transform) would otherwise pin this fixed overlay to the form instead of the screen.
  return createPortal(<div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label="Настройка фото товара" onKeyDown={event => { if (event.key === 'Escape') onCancel(); }}>
    <div className="cropper">
      <div className="cropper-head"><h3>Настройте фото</h3><button type="button" className="portal-icon-button" onClick={onCancel} aria-label="Закрыть без сохранения"><X size={20} aria-hidden="true" /></button></div>
      <p className="cropper-hint">{hint ?? 'Рамка — это ровно то, что покупатели увидят в каталоге и на странице товара.'} Перетащите фото и приблизьте ползунком или колёсиком мыши.</p>
      <div className="cropper-stage">
        <div ref={frameRef} className="cropper-frame" style={{ width: frameWidth, height: frameHeight }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={event => changeZoom(zoom - event.deltaY * 0.0015)}>
          {image && <img src={image.src} alt="" draggable={false} style={{ width: image.naturalWidth * scale, height: image.naturalHeight * scale, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)` }} />}
          {!image && !error && <span className="cropper-loading">Открываем фото…</span>}
          <i className="cropper-grid" aria-hidden="true" />
        </div>
      </div>
      <div className="cropper-zoom"><button type="button" onClick={() => changeZoom(zoom - 0.2)} aria-label="Отдалить"><Minus size={16} aria-hidden="true" /></button><input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-label="Масштаб" /><button type="button" onClick={() => changeZoom(zoom + 0.2)} aria-label="Приблизить"><Plus size={16} aria-hidden="true" /></button><button type="button" className="cropper-rotate" onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw size={16} aria-hidden="true" />Повернуть</button></div>
      {error && <p className="cropper-error" role="alert">{error}</p>}
      <div className="cropper-actions"><button type="button" className="portal-button product-save" disabled={!image} onClick={() => void save()}><Check size={18} aria-hidden="true" />Сохранить фото</button><button type="button" className="product-secondary" onClick={onCancel}>Отмена</button></div>
    </div>
  </div>, document.body);
}
