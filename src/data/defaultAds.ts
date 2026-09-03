import type { Ad } from '../types';

export const DEFAULT_BANNER_SCRIPT = `<script>
  atOptions = {
    'key' : '280410b8223e51dae425f09c7a2f0eb1',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script src="https://glamourpicklessteward.com/280410b8223e51dae425f09c7a2f0eb1/invoke.js"></script>`;

export const DEFAULT_SOCIAL_BAR_1 = `<script src="https://glamourpicklessteward.com/a4/12/67/a412679a12b000c8cd0a802095a46290.js"></script>`;

export const DEFAULT_SOCIAL_BAR_2 = `<script src="https://glamourpicklessteward.com/a4/12/67/a412679a12b000c8fd0a802095a46290.js"></script>`;

export const DEFAULT_ADS: Ad[] = [
  {
    id: 'banner_468x60',
    name: '468x60 Banner Ad',
    type: 'banner_468x60',
    script: DEFAULT_BANNER_SCRIPT,
    status: 'on',
    placement: 'Public Feed & Video Page',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'social_bar_1',
    name: 'Social Bar Ad #1',
    type: 'social_bar',
    script: DEFAULT_SOCIAL_BAR_1,
    status: 'on',
    placement: 'Public Frontend',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'social_bar_2',
    name: 'Social Bar Ad #2',
    type: 'social_bar',
    script: DEFAULT_SOCIAL_BAR_2,
    status: 'on',
    placement: 'Public Frontend',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];
