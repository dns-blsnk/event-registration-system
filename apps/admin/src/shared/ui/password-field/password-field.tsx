import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useState } from 'react';

/**
 * A password input with a button that shows what was typed, to catch a typo before submitting.
 * It owns the input slot (for the button), so callers cannot pass slot props.
 */
export function PasswordField(
  props: Omit<TextFieldProps, 'type' | 'slotProps'>,
): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={isVisible ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={isVisible ? 'Hide password' : 'Show password'}
                onClick={() => {
                  setIsVisible((visible) => !visible);
                }}
              >
                {isVisible ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
