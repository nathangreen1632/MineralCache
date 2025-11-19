import React from 'react';
import { pressBtn } from '../ui/press.ts';

type ConfirmBarProps = {
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmBar({
                                     message = 'You have unsaved changes. Exit without saving?',
                                     confirmLabel = 'Exit without saving',
                                     cancelLabel = 'Keep editing',
                                     onConfirm,
                                     onCancel,
                                   }: Readonly<ConfirmBarProps>): React.ReactElement {
  return (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div className="flex-1 text-sm sm:text-base text-[var(--theme-error)]">
        {message}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className={pressBtn(
            'rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 bg-[var(--theme-error)] text-white ring-1 ring-inset'
          )}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={pressBtn(
            'rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 bg-[var(--theme-success)] text-white ring-1 ring-inset'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
