import { IconClose } from "./Icons";

export default function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <IconClose style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
