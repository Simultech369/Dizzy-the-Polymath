CONFIRMED: In `isLoopbackHost` and `isPrivateLanHost` functions (lib/model_router.mjs:62-98), the IP address validation fails to properly normalize IP address strings before comparison, causing false negatives for valid loopback/private LAN addresses that use alternative representations with leading zeros or different groupings.

Specifically:
- `isLoopbackHost` only accepts exact string "127.0.0.1" for IPv4 loopback, rejecting valid equivalents like "127.000.001.001"
- `isLoopbackHost` only accepts exact string "::1" for IPv6 loopback, rejecting valid equivalents like "0:0:0:0:0:0:0:1" or "::0001"
- `isPrivateLanHost` uses `startsWith()` checks that fail when octets contain leading zeros (e.g., "010.0.0.1" for 10.x.x.x range, "172.016.0.1" for 172.16-31.x.x range)

This causes the system to incorrectly classify private/local addresses as remote cloud, potentially blocking legitimate local connections or allowing private data to leak to cloud backends when it should be blocked.

CONFIRMED: In conversation key normalization (lib/dispatch.mjs:672-680 via `normalizeIdentifier`), different conversation keys can normalize to the same value, causing shared auto-remember state files. For example:
- "user.1 "user_123"
- "user_123_123"

This creates a race condition where two distinct conversations interfere with each other's auto-remember process, leading to incorrect duplicate detection, corrupted state, or missed auto-remember opportunities. Pass 1 found empty string handling (#11) but missed this normalization collision issue.

CONFIRMED: The signature computation for auto-remember (lib/dispatch.mjs:351-365) uses over-aggressive normalization in `normalizeForSignature` that collapses whitespace variations, causing semantically different histories to produce identical signatures. For example:
- History with "Hello   World" and history with "Hello World" both normalize to "hello world"
- This causes false duplicate detection where a new conversation with high signal score is incorrectly blocked as a duplicate due to signature collision from insignificant whitespace differences

Pass 1 noted score saturation (#3) and race conditions (#10) but missed this specific normalization flaw in the signature generation that causes false negatives in auto-remember triggering.