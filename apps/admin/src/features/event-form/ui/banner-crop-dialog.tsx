import { BANNER_ASPECT_RATIO } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

import { cropBanner } from '../lib/crop-banner';

const CROP_AREA_HEIGHT = 320;
const ZOOM_STEP = 0.01;
const START = { x: 0, y: 0 };

/**
 * Picks the 2:1 part of an image that becomes the banner. The frame is fixed, so every banner has
 * the same shape; zoom stops where the cut-out would fall below the minimum size.
 */
export function BannerCropDialog({
  src,
  maxZoom,
  onCancel,
  onCropped,
}: {
  src: string;
  maxZoom: number;
  onCancel: () => void;
  onCropped: (image: Blob) => void;
}): React.JSX.Element {
  const [crop, setCrop] = useState(START);
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | undefined>(undefined);
  const [isCropping, setCropping] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const apply = async (): Promise<void> => {
    if (area === undefined) return;
    setCropping(true);
    try {
      onCropped(await cropBanner(src, area));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be cropped');
      setCropping(false);
    }
  };
  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="md" aria-labelledby="banner-crop-title">
      <DialogTitle id="banner-crop-title">Frame the banner</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Drag to move the picture, zoom to fit. The title is written over the lower part.
          </Typography>
          <Box sx={{ position: 'relative', height: CROP_AREA_HEIGHT, bgcolor: 'grey.900' }}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              maxZoom={maxZoom}
              aspect={BANNER_ASPECT_RATIO}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => {
                setArea(pixels);
              }}
            />
          </Box>
          <Slider
            value={zoom}
            min={1}
            max={maxZoom}
            step={ZOOM_STEP}
            disabled={maxZoom === 1}
            aria-label="Zoom"
            onChange={(_, value) => {
              // A single-thumb slider always reports one number.
              if (typeof value === 'number') setZoom(value);
            }}
          />
          {error !== undefined && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          loading={isCropping}
          disabled={area === undefined}
          onClick={() => void apply()}
        >
          Use this image
        </Button>
      </DialogActions>
    </Dialog>
  );
}
