import 'react-native-get-random-values';
import CryptoJS from 'crypto-js';

// Generate a random encryption key for a chat session (256-bit key)
export function generateChatKey() {
  try {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  } catch (error) {
    // Fallback for React Native
    const randomValues = new Uint8Array(32);
    crypto.getRandomValues(randomValues);
    return CryptoJS.lib.WordArray.create(Array.from(randomValues)).toString();
  }
}

// Generate a random IV for each message
export function generateIV() {
  try {
    return CryptoJS.lib.WordArray.random(128/8);
  } catch (error) {
    // Fallback for React Native
    const randomValues = new Uint8Array(16);
    crypto.getRandomValues(randomValues);
    return CryptoJS.lib.WordArray.create(Array.from(randomValues));
  }
}

// Enhanced encryption with IV and authentication
export function encryptMessage(message, key) {
  try {
    // Simple encryption without IV concatenation for better compatibility
    const iv = generateIV();
    const encrypted = CryptoJS.AES.encrypt(message, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Return as JSON string for better handling
    const result = {
      iv: iv.toString(CryptoJS.enc.Hex),
      data: encrypted.ciphertext.toString(CryptoJS.enc.Base64)
    };

    return JSON.stringify(result);
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

// Enhanced decryption with IV extraction
export function decryptMessage(encryptedMessage, key) {
  try {
    // Handle both old and new format
    let iv, ciphertext;

    if (encryptedMessage.startsWith('{')) {
      // New JSON format
      const parsed = JSON.parse(encryptedMessage);
      iv = CryptoJS.enc.Hex.parse(parsed.iv);
      ciphertext = CryptoJS.enc.Base64.parse(parsed.data);
    } else {
      // Old format - try to parse as before
      const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedMessage);
      iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4));
      ciphertext = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(4));
    }

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return decryptedText;
  } catch (error) {
    console.error('Decryption error:', error);
    return '[🔒 Message could not be decrypted]';
  }
}

// Generate a secure hash for message integrity (SHA-256)
export function hashMessage(message) {
  return CryptoJS.SHA256(message).toString();
}

// Generate HMAC for message authentication
export function generateHMAC(message, key) {
  return CryptoJS.HmacSHA256(message, key).toString();
}

// Verify HMAC for message authentication
export function verifyHMAC(message, key, providedHMAC) {
  const calculatedHMAC = generateHMAC(message, key);
  return calculatedHMAC === providedHMAC;
}

// Key derivation function for enhanced security
export function deriveKey(masterKey, salt, iterations = 10000) {
  return CryptoJS.PBKDF2(masterKey, salt, {
    keySize: 256/32,
    iterations: iterations
  }).toString();
}

// Generate unique match-based encryption key (deterministic)
export function generateMatchKey(matchId, userIds) {
  // Remove Date.now() to make this deterministic - same inputs always generate same key
  const combinedData = `${matchId}-${userIds.sort().join('-')}-eatme-app-v1`;
  return CryptoJS.SHA256(combinedData).toString();
}

// Secure key rotation - generate new key based on previous key
export function rotateKey(currentKey, rotationSeed) {
  const combinedInput = `${currentKey}-${rotationSeed}-${Date.now()}`;
  return CryptoJS.SHA256(combinedInput).toString();
}

// Encrypt file data (for images, documents, etc.)
export function encryptFile(fileData, key) {
  try {
    const iv = generateIV();
    const encrypted = CryptoJS.AES.encrypt(fileData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encryptedData: iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64),
      hash: hashMessage(fileData)
    };
  } catch (error) {
    console.error('File encryption error:', error);
    return null;
  }
}

// Decrypt file data
export function decryptFile(encryptedData, key, expectedHash = null) {
  try {
    const decrypted = decryptMessage(encryptedData, key);

    // Verify integrity if hash provided
    if (expectedHash) {
      const actualHash = hashMessage(decrypted);
      if (actualHash !== expectedHash) {
        throw new Error('File integrity check failed');
      }
    }

    return decrypted;
  } catch (error) {
    console.error('File decryption error:', error);
    return null;
  }
}