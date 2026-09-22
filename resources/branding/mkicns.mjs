// Minimal ICNS writer: embeds PNG payloads into standard icon-family chunks.
// Usage: node mkicns.mjs <build-dir-with-badge-PNGs> <output.icns>
import fs from 'node:fs';

const buildDir = process.argv[2];
const out = process.argv[3];
if (!buildDir || !out) {
	console.error('usage: node mkicns.mjs <build-dir> <output.icns>');
	process.exit(1);
}

const chunks = [
	['ic04', 16],   // 16x16
	['ic05', 32],   // 32x32
	['ic11', 32],   // 16x16@2x
	['ic12', 64],   // 32x32@2x
	['ic07', 128],  // 128x128
	['ic08', 256],  // 256x256
	['ic13', 512],  // 256x256@2x
	['ic09', 512],  // 512x512
	['ic14', 1024], // 512x512@2x
	['ic10', 1024], // 1024x1024
];

const parts = chunks.map(([type, size]) => {
	const png = fs.readFileSync(`${buildDir}/badge-${size}.png`);
	const head = Buffer.alloc(8);
	head.write(type, 0, 'ascii');
	head.writeUInt32BE(8 + png.length, 4);
	return Buffer.concat([head, png]);
});

const body = Buffer.concat(parts);
const header = Buffer.alloc(8);
header.write('icns', 0, 'ascii');
header.writeUInt32BE(8 + body.length, 4);
fs.writeFileSync(out, Buffer.concat([header, body]));
console.log(`wrote ${out} (${8 + body.length} bytes)`);
