import { useEffect, useRef } from 'react';
import { Save, LogOut } from 'lucide-react';

export default function ExitConfirmationModal({
  isOpen,
  onClose,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  characterName = 'this character',
}) {
  const saveButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    saveButtonRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* DaisyUI modal — bottom on mobile, middle on sm+ */
    <dialog className="modal modal-bottom sm:modal-middle" open>
      <div className="modal-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="modal-box max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
      >
        <h3 id="exit-modal-title" className="font-bold text-lg mb-2">
          Save your character draft?
        </h3>
        <p className="text-base-content/70 mb-6">
          You have unsaved changes to{' '}
          <span className="font-medium text-base-content">{characterName}</span>.
          Would you like to save your progress before leaving?
        </p>

        <div className="modal-action flex-col gap-2 mt-0">
          <button
            ref={saveButtonRef}
            onClick={onSaveAndLeave}
            className="btn btn-primary btn-block gap-2"
            style={{ minHeight: '44px' }}
          >
            <Save className="w-4 h-4" />
            Save Draft &amp; Leave
          </button>

          <button
            onClick={onLeaveWithoutSaving}
            className="btn btn-neutral btn-block gap-2"
            style={{ minHeight: '44px' }}
          >
            <LogOut className="w-4 h-4" />
            Leave Without Saving
          </button>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-block"
            style={{ minHeight: '44px' }}
          >
            Stay on Page
          </button>
        </div>
      </div>
    </dialog>
  );
}
