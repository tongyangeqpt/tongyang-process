import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Generates smaller images inside dist only. Never changes CMS originals or logos.
export async function optimizeMedia(sourceDirectory, outputDirectory) {
  const variants = new Map();
  if (!fs.existsSync(sourceDirectory)) return variants;

  const candidates = [];
  function visit(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const sub = path.join(rel, entry.name);
      if (entry.isDirectory()) visit(path.join(dir, entry.name), sub);
      else if (/\.(png|jpe?g)$/i.test(entry.name) && !/(?:logo|favicon|icon|brand)/i.test(entry.name)) {
        const source = path.join(dir, entry.name);
        if (fs.statSync(source).size >= 100 * 1024) candidates.push({ source, relative: sub });
      }
    }
  }
  visit(sourceDirectory);

  let index = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (index < candidates.length) {
      const { source, relative } = candidates[index++];
      try {
        const input = fs.readFileSync(source);
        const hash = crypto.createHash('sha256').update(input).digest('hex').slice(0, 10);
        const name = relative.replace(/\.(png|jpe?g)$/i, '');
        const output = {};
        const original = await sharp(input).metadata();
        for (const [key, width, quality] of [['small', 720, 76], ['large', 1500, 82]]) {
          const filename = name + '.' + hash + '.' + key + '.webp';
          const destination = path.join(outputDirectory, filename);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          const result = await sharp(input)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality, effort: 4 })
            .toFile(destination);
          if (result.size < input.length) output[key] = '/media/' + filename.split(path.sep).join('/');
          else fs.unlinkSync(destination);
        }
        if (output.small || output.large) {
          variants.set('/media/' + relative.split(path.sep).join('/'), {
            small: output.small || output.large,
            large: output.large || output.small,
            width: original.autoOrient?.width || original.width,
            height: original.autoOrient?.height || original.height
          });
        }
      } catch (err) {
        console.warn('Image optimization skipped:', relative, err.message);
      }
    }
  });
  await Promise.all(workers);
  console.log('Optimized images:', variants.size, 'of', candidates.length, 'original photos');
  return variants;
}
