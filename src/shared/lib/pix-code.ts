// EMV BR Code (Pix) generator — payload completo com CRC16-CCITT
// Suporta valor dinâmico por produto.

const tlv = (id: string, value: string) => {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
};

const crc16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const sanitize = (str: string, max: number) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, max)
    .trim() || "N";

export interface PixPayloadInput {
  pixKey: string;
  amount?: number; // em reais
  merchantName: string;
  merchantCity: string;
  txid?: string; // ref opcional (max 25)
}

export const generatePixPayload = ({
  pixKey,
  amount,
  merchantName,
  merchantCity,
  txid = "***",
}: PixPayloadInput): string => {
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey.trim());

  const additionalData = tlv("05", sanitize(txid, 25));

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986");

  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));
  }

  payload +=
    tlv("58", "BR") +
    tlv("59", sanitize(merchantName, 25)) +
    tlv("60", sanitize(merchantCity, 15)) +
    tlv("62", additionalData);

  const partial = payload + "6304";
  return partial + crc16(partial);
};
