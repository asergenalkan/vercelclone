import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENV_ENCRYPTION_KEY || "default-encryption-key-change-this";

/**
 * Bir metni şifreleyen fonksiyon
 * @param text Şifrelenecek metin
 * @returns Şifrelenmiş metin (hex formatında)
 */
export function encrypt(text: string): string {
  try {
    // Sabit IV değeri oluştur (güvenlik için gerçek uygulamalarda rastgele olmalı)
    const iv = Buffer.from("0000000000000000"); // 16 bytes IV
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32); // 32 bytes key
    
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch (error) {
    console.error("Şifreleme hatası:", error);
    throw new Error("Şifreleme başarısız");
  }
}

/**
 * Şifreli bir metni çözen fonksiyon
 * @param encryptedText Şifrelenmiş metin (hex formatında)
 * @returns Çözülmüş metin
 */
export function decrypt(encryptedText: string): string {
  try {
    // Önce değerin şifrelenmiş olup olmadığını kontrol et
    if (!isEncrypted(encryptedText)) {
      // Şifrelenmemiş değeri olduğu gibi döndür
      return encryptedText;
    }
    
    // Sabit IV değeri - encrypt fonksiyonu ile aynı olmalı
    const iv = Buffer.from("0000000000000000"); // 16 bytes IV
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32); // 32 bytes key
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Şifre çözme hatası:", error);
    // Hata durumunda orijinal değeri döndür
    return encryptedText;
  }
}

/**
 * Bir değerin şifrelenmiş olup olmadığını kontrol eden fonksiyon
 * @param value Kontrol edilecek değer
 * @returns Şifrelenmiş ise true, değilse false
 */
export function isEncrypted(value: string): boolean {
  // Boş veya çok kısa değerler şifrelenmiş olamaz
  if (!value || value.length < 32) {
    return false;
  }
  
  // Hex formatında olup olmadığını kontrol et
  // Şifrelenmiş değerler her zaman hex formatında olacak
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(value)) {
    return false;
  }
  
  // Şifrelenmiş değerler genellikle belirli bir uzunlukta olur
  // AES-256-CBC ile şifrelenmiş değerler 32'nin katları olmalı
  if (value.length % 32 !== 0) {
    return false;
  }
  
  return true;
} 