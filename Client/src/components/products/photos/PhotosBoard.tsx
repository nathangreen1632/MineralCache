import React from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { ProductPhoto } from '../../../api/vendor';
import PhotoCard from './PhotoCard';

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const res = Array.from(list);
  const [removed] = res.splice(startIndex, 1);
  res.splice(endIndex, 0, removed);
  return res;
}

export default function PhotosBoard({
                                      photos,
                                      onReorder,
                                      onMakePrimary,
                                      onToggleDelete,
                                    }: Readonly<{
  photos: ProductPhoto[];
  onReorder: (next: ProductPhoto[]) => void;
  onMakePrimary: (photoId: number) => void;
  onToggleDelete: (p: ProductPhoto) => void;
}>): React.ReactElement {
  function onDragEnd(result: DropResult) {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.index === source.index) return;
    const next = reorder(photos, source.index, destination.index).map((p, i) => ({ ...p, position: i }));
    onReorder(next);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="photos-grid" direction="horizontal" renderClone={null}>
        {(droppable) => (
          <div
            role="text"
            aria-label="Product photos (drag handle to reorder)"
            ref={droppable.innerRef}
            {...droppable.droppableProps}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {photos.map((p, idx) => (
              <Draggable draggableId={String(p.id)} index={idx} key={p.id} isDragDisabled={false}>
                {(provided) => (
                  <PhotoCard
                    photo={p}
                    onMakePrimary={onMakePrimary}
                    onToggleDelete={onToggleDelete}
                    innerRef={provided.innerRef}
                    draggableProps={provided.draggableProps}
                    dragHandleProps={provided.dragHandleProps}
                  />
                )}
              </Draggable>
            ))}
            {droppable.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
