import React from 'react';
import { GripVertical } from 'lucide-react';
import type { ProductPhoto } from '../../../api/vendor';
import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

type Props = {
  photo: ProductPhoto;
  onMakePrimary: (photoId: number) => void;
  onToggleDelete: (p: ProductPhoto) => void;
  // DnD
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  draggableProps?: DraggableProvidedDraggableProps;
  innerRef?: (el: HTMLElement | null) => void;
};

export default function PhotoCard({
                                    photo: p,
                                    onMakePrimary,
                                    onToggleDelete,
                                    dragHandleProps,
                                    draggableProps,
                                    innerRef,
                                  }: Readonly<Props>): React.ReactElement {
  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;
  const thumb = 'h-28 w-28 rounded-lg object-cover';
  const info = 'text-[10px] opacity-70';

  const src = p.url1600 || p.url800 || p.url320 || p.url || '';
  const ring = p.isPrimary ? 'ring-2' : 'ring-0';
  const opacity = p.deletedAt ? 'opacity-40' : 'opacity-100';

  return (
    <div
      ref={innerRef as any}
      className={`rounded-2xl border p-2 grid gap-2 ${opacity}`}
      style={card}
      {...draggableProps}
    >
      {/* Drag handle (ONLY interactive element that starts drag) */}
      <button
        type="button"
        aria-label="Drag to reorder"
        className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-1 ring-1 ring-inset self-start"
        style={{ borderColor: 'var(--theme-border)' }}
        {...dragHandleProps}
      >
        <GripVertical className="h-3.5 w-3.5" />
        Drag
      </button>

      <img src={src} alt="" className={`${thumb} ${ring}`} style={{ borderColor: 'var(--theme-border)' }} />

      <div className="grid gap-1">
        <div className={info}>pos {p.position}</div>
        <div className="flex gap-2">
          {p.url320 ? <a className={info} href={p.url320} target="_blank" rel="noreferrer">320</a> : null}
          {p.url800 ? <a className={info} href={p.url800} target="_blank" rel="noreferrer">800</a> : null}
          {p.url1600 ? <a className={info} href={p.url1600} target="_blank" rel="noreferrer">1600</a> : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex rounded-md px-2 py-1 text-xs font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] disabled:opacity-60"
            onClick={() => onMakePrimary(p.id)}
            disabled={!!p.deletedAt || p.isPrimary}
          >
            {p.isPrimary ? 'Primary' : 'Set primary'}
          </button>
          <button
            type="button"
            className="inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset"
            style={{ borderColor: 'var(--theme-border)' }}
            onClick={() => onToggleDelete(p)}
          >
            {p.deletedAt ? 'Restore' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
