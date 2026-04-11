const imagemin = require('imagemin').default;
const imageminPngquant = require('imagemin-pngquant');
const imageminJpegtran = require('imagemin-jpegtran');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'public');
const outputDir = inputDir; // Overwrite originals

async function compressImages() {
  const files = await imagemin(
    [`${inputDir}/**/*.{jpg,png}`],
    {
      destination: inputDir,
      plugins: [
        imageminJpegtran(),
        imageminPngquant({
          quality: [0.6, 0.8]
        })
      ]
    }
  );

  console.log(`Compressed ${files.length} images`);
}

compressImages().catch(console.error);