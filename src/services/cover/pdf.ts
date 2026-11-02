// a one-page pdf holding one jpeg, at an exact size. printers take this for a cover.

const enc = new TextEncoder();

export function jpegToPdf(jpeg: Uint8Array, widthPx: number, heightPx: number, widthIn: number, heightIn: number): Uint8Array {
  const wPt = +(widthIn * 72).toFixed(2);
  const hPt = +(heightIn * 72).toFixed(2);
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}`);
    if (stream) { push('\nstream\n'); push(stream); push('\nendstream'); }
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%âãÏÓ\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  const content = enc.encode(`q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`);
  object(4, `<< /Length ${content.length} >>`, content);
  object(5, `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);

  const xref = length;
  let table = `xref\n0 6\n0000000000 65535 f \n`;
  for (let n = 1; n <= 5; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
