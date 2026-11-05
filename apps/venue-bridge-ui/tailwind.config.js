const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../libs/ui/tailwind-preset.js')],
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*!(*.spec).{ts,tsx}'),
    join(__dirname, '../../libs/ui/src/**/*!(*.spec).{ts,tsx}'),
  ],
};
