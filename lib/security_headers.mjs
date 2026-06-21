export function securityHeaders(config = {}) {
  const verifiedHttps = !!config.verifiedHttps;

  return function middleware(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

    if (verifiedHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }

    // Default closed CSP. Express handlers can override this via res.setHeader("Content-Security-Policy", ...)
    res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

    next();
  };
}
