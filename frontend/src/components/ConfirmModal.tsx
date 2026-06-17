import React from 'react';
import * as audio from './AudioEffects';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleCancel = () => {
    audio.playPlaceSound();
    onCancel();
  };

  const handleConfirm = () => {
    audio.playPlaceSound();
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚠️</span>
          <h3 className="text-base font-bold text-white tracking-tight">
            {title}
          </h3>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-2.5 mt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-all border border-neutral-700/50 hover:border-neutral-600 active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all shadow-lg shadow-rose-700/20 active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
