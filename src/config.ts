export const PORT = 47800;
export const MASTER_USER = 'Malaiyalan';
export const MASTER_NAME = "Malaiyalan's Device";
// Salted SHA-512 of the Master password (never store the plain text). NOTE: anyone with the APK can still try to brute-force this.
export const PW_SALT = 'lc-c24e9720a34ca510';
export const PW_HASH = 'cda09c63427382a9926c68c7980ef39dade51c59006b0c30c491d05ff31a407fa1e88dc7d39fb9844aaa8a52c5aaaaf9b4cffa8719203e4e14add88977929916';
export const TERMS = [
 '1. Purpose. LocalConnect lets a Master device view and copy ONLY the files or folders you choose to share.',
 '2. Your consent. Accepting these terms does NOT share anything. Sharing starts only after you pick files/folders in the Android system picker.',
 '3. Scope. The Master can access only the items you selected. It cannot scan or browse anything else on your phone.',
 '4. Transparency. The Master identity is always shown. Every list/download action is recorded in your Access History on this device.',
 '5. Control. You may revoke file access or disconnect the Master at any time. Access stops immediately, including transfers in progress.',
 '6. Copies. Files already downloaded by the Master stay on the Master device; revoking does not delete them.',
 '7. Network. Communication happens directly between devices on the local network and is encrypted. No files are uploaded to any server.',
 '8. Development build. This is a testing build. Use it only with devices you trust.',
].join('\n\n');
