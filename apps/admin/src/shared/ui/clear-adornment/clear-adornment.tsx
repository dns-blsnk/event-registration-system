import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

/**
 * The clear button at the end of a filter field. Its room is always kept and the button only
 * hidden while there is nothing to clear, so the field never changes width as text comes and goes.
 * A hidden button is also out of the tab order and unseen by screen readers.
 */
export function ClearAdornment({
  label,
  isHidden,
  onClear,
}: {
  label: string;
  isHidden: boolean;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <InputAdornment position="end" sx={isHidden ? { visibility: 'hidden' } : {}}>
      <IconButton
        size="small"
        edge="end"
        aria-label={`Clear ${label}`}
        // Pressing it must not blur the field first: a date field applies what was typed on blur.
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={onClear}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </InputAdornment>
  );
}
