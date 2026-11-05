const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../libs/ui/tailwind-preset.js')],
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    // The shared components (libs/ui) are found through their path, not the project graph
    join(__dirname, '../../libs/ui/src/**/*!(*.spec).{ts,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
