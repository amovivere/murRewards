const COLORS = ['#F55A5F', '#4E7CFF', '#A970FF', '#2DD4BF', '#F5C97B', '#EC4899', '#00C8FF', '#A3A3A3'];

export default function ColorPalette({ value, onChange }) {
  return (
    <div className="modal-color-palette">
      {COLORS.map((color) => (
        <button
          key={color}
          className={`modal-color${value.toLowerCase() === color.toLowerCase() ? ' is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          title={color}
          type="button"
        />
      ))}
      <label className="modal-color modal-color--picker" title="Свой цвет">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}
