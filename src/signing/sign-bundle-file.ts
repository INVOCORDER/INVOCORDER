import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import { loadSigningKeyFile } from "./keys/key-store.js";

export type SignedBundleEnvelope = {
  object_type: "INVOCORDER_SIGNED_BUNDLE_ENVELOPE";
  schema_version: "0.3.1";
  bundle_path: string;
  bundle_sha256: string;
  signature_algorithm: "ed25519";
  public_key_pem: string;
  public_key_fingerprint: string;
  signature_base64: string;
  key_mode: "ephemeral" | "persistent";
  claims: {
    proves_truth: false;
    proves_safety: false;
    proves_authorization: false;
    proves_integrity_signature: true;
  };
};

function writeEnvelope(bundlePath: string, envelope: SignedBundleEnvelope): SignedBundleEnvelope {
  writeFileSync(join(dirname(bundlePath), "signed-bundle-envelope.json"), JSON.stringify(envelope, null, 2) + "\n");
  return envelope;
}

function fingerprint(publicKeyPem: string): string {
  return createHash("sha256").update(publicKeyPem).digest("hex");
}

export function signBundleFile(bundlePath: string): SignedBundleEnvelope {
  const bundleBytes = readFileSync(bundlePath);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const signature = sign(null, bundleBytes, privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  return writeEnvelope(bundlePath, {
    object_type: "INVOCORDER_SIGNED_BUNDLE_ENVELOPE",
    schema_version: "0.3.1",
    bundle_path: bundlePath,
    bundle_sha256: createHash("sha256").update(bundleBytes).digest("hex"),
    signature_algorithm: "ed25519",
    public_key_pem: publicKeyPem,
    public_key_fingerprint: fingerprint(publicKeyPem),
    signature_base64: signature.toString("base64"),
    key_mode: "ephemeral",
    claims: {
      proves_truth: false,
      proves_safety: false,
      proves_authorization: false,
      proves_integrity_signature: true
    }
  });
}

export function signBundleFileWithKey(bundlePath: string, privateKeyPath: string): SignedBundleEnvelope {
  const bundleBytes = readFileSync(bundlePath);
  const key = loadSigningKeyFile(privateKeyPath);
  const signature = sign(null, bundleBytes, key.privateKey);

  return writeEnvelope(bundlePath, {
    object_type: "INVOCORDER_SIGNED_BUNDLE_ENVELOPE",
    schema_version: "0.3.1",
    bundle_path: bundlePath,
    bundle_sha256: createHash("sha256").update(bundleBytes).digest("hex"),
    signature_algorithm: "ed25519",
    public_key_pem: key.publicKeyPem,
    public_key_fingerprint: key.publicKeyFingerprint,
    signature_base64: signature.toString("base64"),
    key_mode: "persistent",
    claims: {
      proves_truth: false,
      proves_safety: false,
      proves_authorization: false,
      proves_integrity_signature: true
    }
  });
}

export function verifySignedBundleEnvelope(envelopePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const envelope = JSON.parse(readFileSync(envelopePath, "utf8")) as SignedBundleEnvelope;
  const resolvedBundlePath = envelope.bundle_path.startsWith("/")
    ? envelope.bundle_path
    : join(dirname(envelopePath), envelope.bundle_path);
  const bundleBytes = readFileSync(resolvedBundlePath);

  const actualBundleSha = createHash("sha256").update(bundleBytes).digest("hex");
  if (actualBundleSha !== envelope.bundle_sha256) {
    errors.push("bundle sha256 mismatch");
  }

  if (fingerprint(envelope.public_key_pem) !== envelope.public_key_fingerprint) {
    errors.push("public key fingerprint mismatch");
  }

  if (envelope.claims.proves_truth !== false) errors.push("signature envelope overclaims truth");
  if (envelope.claims.proves_safety !== false) errors.push("signature envelope overclaims safety");
  if (envelope.claims.proves_authorization !== false) errors.push("signature envelope overclaims authorization");
  if (envelope.claims.proves_integrity_signature !== true) errors.push("signature envelope does not claim integrity signature");

  const validSignature = verify(
    null,
    bundleBytes,
    envelope.public_key_pem,
    Buffer.from(envelope.signature_base64, "base64")
  );

  if (!validSignature) {
    errors.push("signature verification failed");
  }

  return { valid: errors.length === 0, errors };
}
