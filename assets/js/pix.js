/* =========================================================
   rateio2you — Pix (BR Code) demonstrativo
   Gera o código copia-e-cola e o QR Code localmente.
   ========================================================= */

const Pix = (() => {
  const pad2 = (n) => String(n).padStart(2, "0");

  function field(id, value) {
    const v = String(value);
    return id + pad2(v.length) + v;
  }

  function normalize(text, max) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 .\-]/g, "")
      .toUpperCase()
      .slice(0, max);
  }

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function build({ key, merchant, city, amount, txid }) {
    const safeTxid = String(txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
    let payload = "";
    payload += field("00", "01");
    payload += field("26", field("00", "BR.GOV.BCB.PIX") + field("01", key));
    payload += field("52", "0000");
    payload += field("53", "986");
    if (amount && Number(amount) > 0) payload += field("54", Number(amount).toFixed(2));
    payload += field("58", "BR");
    payload += field("59", normalize(merchant, 25) || "RATEIO2YOU");
    payload += field("60", normalize(city, 15) || "SAO PAULO");
    payload += field("62", field("05", safeTxid));
    payload += "6304";
    return payload + crc16(payload);
  }

  function qrSvg(code, size = 190) {
    try {
      if (typeof qrcode !== "function") return "";
      const qr = qrcode(0, "M");
      qr.addData(code);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true })
        .replace("<svg", `<svg width="${size}" height="${size}"`);
    } catch (e) {
      return "";
    }
  }

  return { build, qrSvg };
})();
