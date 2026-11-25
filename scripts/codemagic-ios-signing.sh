#!/usr/bin/env bash
# Fresh iOS Distribution certificate and App Store profile on every build.
# Same pattern as the other Shame Logic apps: revoke old Distribution
# certificates, mint a new key, then create the Fold profile.
set -euo pipefail

: "${BUNDLE_ID:?BUNDLE_ID is required}"
: "${XCODE_PROJECT:?XCODE_PROJECT is required}"

ISSUER="${APP_STORE_CONNECT_ISSUER_ID:-d1c9f1ec-32ea-48e5-8af7-805c2fff4bce}"
KID="${APP_STORE_CONNECT_KEY_IDENTIFIER:-G2TS36UZR4}"

echo "=== Revoking iOS Distribution certificates (not Managed) ==="
pip3 install PyJWT cryptography 2>/dev/null || pip3 install --user PyJWT cryptography

export FOLD_ASC_ISSUER="$ISSUER"
export FOLD_ASC_KID="$KID"

python3 <<'PYEOF'
import json, os, subprocess, sys, time

try:
    import jwt
except ImportError:
    sys.path.insert(0, subprocess.check_output(["python3", "-m", "site", "--user-site"]).decode().strip())
    import jwt

from urllib.request import Request, urlopen

issuer = os.environ["FOLD_ASC_ISSUER"]
kid = os.environ["FOLD_ASC_KID"]

key_path = subprocess.check_output(
    "find /Users/builder/.appstoreconnect/private_keys -name '*.p8' 2>/dev/null | head -1",
    shell=True,
).decode().strip()
if key_path:
    print(f"Using key file: {key_path}")
    with open(key_path, encoding="utf-8") as f:
        key = f.read()
else:
    raw = os.environ.get("APP_STORE_CONNECT_PRIVATE_KEY", "").strip()
    if not raw:
        raise SystemExit("No App Store Connect .p8 key (SarcNav integration or APP_STORE_CONNECT_PRIVATE_KEY)")
    if os.path.isfile(raw):
        print(f"Using key path from env: {raw}")
        with open(raw, encoding="utf-8") as f:
            key = f.read()
    else:
        key = raw.replace("\\n", "\n")
        print("Using APP_STORE_CONNECT_PRIVATE_KEY env")

token = jwt.encode(
    {"iss": issuer, "iat": int(time.time()), "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"},
    key,
    algorithm="ES256",
    headers={"kid": kid},
)
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

certs = json.loads(urlopen(Request("https://api.appstoreconnect.apple.com/v1/certificates?limit=200", headers=headers)).read()).get("data", [])
print(f"Total certificates: {len(certs)}")
for cert in certs:
    cert_type = cert["attributes"]["certificateType"]
    name = cert["attributes"].get("name", "unknown")
    cert_id = cert["id"]
    print(f"  {cert_type}: {name} ({cert_id})")
    if "DISTRIBUTION" in cert_type and "MANAGED" not in cert_type:
        try:
            urlopen(Request(f"https://api.appstoreconnect.apple.com/v1/certificates/{cert_id}", headers=headers, method="DELETE"))
            print("    -> Revoked")
        except Exception as err:
            print(f"    -> Revoke failed: {err}")

print("Done revoking Distribution certificates")
PYEOF

echo "=== Generating fresh Distribution certificate key ==="
CERT_KEY_FILE=/tmp/build_cert_key.pem
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | \
  openssl pkcs8 -topk8 -nocrypt -outform PEM > "$CERT_KEY_FILE"
echo "Key size: $(wc -c < "$CERT_KEY_FILE") bytes"

echo "=== Creating certificate + App Store profile for $BUNDLE_ID ==="
app-store-connect fetch-signing-files "$BUNDLE_ID" \
  --type IOS_APP_STORE \
  --certificate-key "@file:$CERT_KEY_FILE" \
  --create

echo "=== Installing certificate into keychain ==="
keychain initialize
keychain add-certificates

mkdir -p "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
cp "$HOME/Library/MobileDevice/Provisioning Profiles/"* \
  "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/" 2>/dev/null || true

echo "=== Applying provisioning profiles ==="
xcode-project use-profiles --project "$XCODE_PROJECT"

echo "=== Signing after use-profiles ==="
grep -E "CODE_SIGN_STYLE|PROVISIONING_PROFILE|DEVELOPMENT_TEAM|PRODUCT_BUNDLE" \
  "$XCODE_PROJECT/project.pbxproj" | head -40

if ! grep -q "PROVISIONING_PROFILE_SPECIFIER" "$XCODE_PROJECT/project.pbxproj"; then
  echo "ERROR: no App Store profile assigned for $BUNDLE_ID"
  exit 1
fi
