/** Download scrcpy win64 zip via node fetch (curl schannel fails in sandbox). */
const fs = require('fs');
const url = 'https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-win64-v4.1.zip';

(async () => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync('tools/scrcpy/scrcpy.zip', buf);
  console.log('downloaded', buf.length, 'bytes');
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
