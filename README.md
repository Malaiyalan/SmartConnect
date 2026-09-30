# LocalConnect

Consent-based local file exchange for Android (React Native + TypeScript). No cloud; devices talk directly on the same Wi-Fi.

**Master login (only Master needs it):** username `Malaiyalan`, password `Malai@7284`. Only a salted hash is stored in `src/config.ts`. Change it by regenerating `PW_SALT`/`PW_HASH`. Since the hash ships inside the APK, treat this as a dev-only gate.

## Get the APK (two ways)
**A. GitHub (no local setup):** push this folder to a new GitHub repo. The workflow `.github/workflows/build-apk.yml` runs on push. Open Actions, then the run, then download the `LocalConnect-apk` artifact. It is signed with the debug key, which is fine for installing on your own phones.

**B. Locally:** install Node 22+, JDK 17, Android Studio (SDK). Then:
```
npm install --legacy-peer-deps
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```
For live development: `npm start` and `npx react-native run-android`.

## Test with two phones (same Wi-Fi, router client isolation OFF)
1. Install the APK on both phones.
2. Phone A: **Master** → login → **+ Connect Device** (QR + 6-digit code shown).
3. Phone B: **User** → **Scan QR** (or enter Master IP + code) → **Connect**.
4. Phone B shows the Master identity → **View Terms** → scroll to the end, tick the box → **Accept & Continue**.
5. Phone B: **Choose Files** or **Choose Folder** (Android system picker).
6. Phone A: card shows Granted; **Browse Files** shows only what B picked; **Download**. Files are saved to the app's external folder `Android/data/<app>/files/LocalConnect/<device>/`.
7. Phone B: Access History shows each event. Tap **Revoke File Access**: Phone A is denied immediately (even mid-transfer).
8. Phone B: **Disconnect Master**. Phone A can pair with a third phone; each device's consent is independent.
The **Debug** screen shows IDs, IP, states, file count and the 4-digit check code (should match on both phones).

## How consent is enforced
`src/core/consent.ts` (unit-tested: `npx jest`) runs on the User phone and is the only authority. Every list/download is checked: connected → T&C accepted → permission granted → inside picked URIs → session not expired, and re-checked for every chunk. Terms acceptance alone never grants access.

## Design notes / known limits (please read)
- **Direction:** the User connects *to* the Master (Master listens on port 47800 and advertises via mDNS). This avoids inbound-firewall problems on phones; consent logic is unchanged.
- **Encryption:** ephemeral X25519 key exchange + XSalsa20-Poly1305 (tweetnacl). The 4-digit check code exists so users can spot a man-in-the-middle; compare it on both screens for sensitive use.
- Files are read fully into memory before chunking, so keep files to a few hundred MB at most. Pause/resume works at chunk level within a live connection; resuming after a dropped connection restarts the file.
- Access logs and history are in memory (cleared on app restart). No foreground-service notification yet.
- **Not verified:** the app was type-checked and the consent core unit-tested, but it has NOT been built into an APK or run on a device. This React Native version is very new, so some third-party native libraries (tcp-socket, zeroconf, saf-x, camera-kit, fs) may need version bumps or small fixes on first build. Expect a debugging pass.
