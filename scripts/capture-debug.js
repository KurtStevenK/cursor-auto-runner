/* Quick diagnostic: capture the screen and save the thumbnail to disk. */
const { app, desktopCapturer, screen } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  for (const display of screen.getAllDisplays()) {
    const scale = display.scaleFactor;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale),
      },
    });
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
    if (!source) { console.log(`display ${display.id}: no source`); continue; }
    const thumb = source.thumbnail;
    const out = path.join(__dirname, `..`, `capture-debug-display${display.id}.png`);
    fs.writeFileSync(out, thumb.toPNG());
    console.log(`display ${display.id} label=${source.name} display_id=${source.display_id} ` +
      `thumb=${thumb.getSize().width}x${thumb.getSize().height} scaleFactor=${scale} -> ${out}`);
  }
  app.exit(0);
});
