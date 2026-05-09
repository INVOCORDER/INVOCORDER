import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, KeyObject } from "node:crypto";

export type SigningKeyPair = {
  privateKey: KeyObject;
  publicKeyPem: string;
  publicKeyFingerprint: string;
};

export function publicKeyFingerprint(publicKeyPem: string): string {
  return createHash("sha256").update(publicKeyPem).digest("hex");
}

export function createSigningKeyFile(privateKeyPath: string): { public_key_pem: string; public_key_fingerprint: string } {
  mkdirSync(dirname(privateKeyPath), { recursive: true });

  if (existsSync(privateKeyPath)) {
    throw new Error(`signing key already exists: ${privateKeyPath}`);
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  writeFileSync(privateKeyPath, privateKeyPem, { mode: 0o600 });

  return {
    public_key_pem: publicKeyPem,
    public_key_fingerprint: publicKeyFingerprint(publicKeyPem)
  };
}

export function loadSigningKeyFile(privateKeyPath: string): SigningKeyPair {
  const privateKeyPem = readFileSync(privateKeyPath, "utf8");
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  return {
    privateKey,
    publicKeyPem,
    publicKeyFingerprint: publicKeyFingerprint(publicKeyPem)
  };
}
