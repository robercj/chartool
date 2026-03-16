import { useEffect, useRef } from 'react';
import { Save, LogOut, X } from 'lucide-react';

export default function ExitConfirmationModal({
  isOpen,
  onClose,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  characterName = 'this character',
}) {
  const modalRef = useRef(null);
  const saveButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    saveButtonRef.current?.focus();

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="exit-modal-title" className="text-lg font-semibold text-white">
            Save your character draft?
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-gray-300">
            You have unsaved changes to <span className="text-white font-medium">{characterName}</span>. 
            Would you like to save your progress before leaving?
          </p>
        </div>
        
        <div className="flex flex-col gap-2 p-4 pt-0">
          <button
            ref={saveButtonRef}
            onClick={onSaveAndLeave}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            <Save className="w-4 h-4" />
            Save Draft & Leave
          </button>
          
          <button
            onClick={onLeaveWithoutSaving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            <LogOut className="w-4 h-4" />
            Leave Without Saving
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-gray-400 hover:text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Stay on Page
          </button>
        </div>
      </div>
    </div>
  );
}
