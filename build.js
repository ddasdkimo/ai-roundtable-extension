#!/usr/bin/env node

// AI Roundtable - Build Script
// Copies src/, public/, and manifest.json into dist/ for Chrome extension loading

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  console.log('Building AI Roundtable extension...');

  // Clean dist
  cleanDir(DIST);

  // Copy directories
  copyDir(path.join(ROOT, 'src'), path.join(DIST, 'src'));
  copyDir(path.join(ROOT, 'public'), path.join(DIST, 'public'));

  // Copy manifest.json
  fs.copyFileSync(
    path.join(ROOT, 'manifest.json'),
    path.join(DIST, 'manifest.json')
  );

  console.log('Build complete -> dist/');
}

// Watch mode
if (process.argv.includes('--watch')) {
  build();
  console.log('Watching for changes...');

  const watchDirs = ['src', 'public'];
  for (const dir of watchDirs) {
    const fullPath = path.join(ROOT, dir);
    fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
      if (filename) {
        console.log(`Changed: ${dir}/${filename}`);
      }
      build();
    });
  }

  // Also watch manifest.json
  fs.watch(path.join(ROOT, 'manifest.json'), () => {
    console.log('Changed: manifest.json');
    build();
  });
} else {
  build();
}
