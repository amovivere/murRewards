import Button from './Button.jsx';
import Modal from './Modal.jsx';

export default function ConfirmModal({
  open,
  title,
  text,
  confirmLabel = 'Подтвердить',
  danger = false,
  busy = false,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Выполняем…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className={danger ? 'modal-danger-note' : 'modal-hint'}>{text}</div>
    </Modal>
  );
}
