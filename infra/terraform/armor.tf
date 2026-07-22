# Full WAF policy, attached to the API backend service (run.tf/lb.tf).
# Preconfigured OWASP CRS rules cover the classes of attack the pasted
# architecture called out specifically (SQLi, XSS, etc.); a rate-limit rule
# guards against brute-force/scraping on top of that.
resource "google_compute_security_policy" "api" {
  name = "ehr-translator-api"

  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection"
  }

  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block cross-site scripting"
  }

  rule {
    action   = "deny(403)"
    priority = 1002
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block local file inclusion"
  }

  rule {
    action   = "deny(403)"
    priority = 1003
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Block remote code execution"
  }

  rule {
    action   = "deny(403)"
    priority = 1004
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('scannerdetection-v33-stable')"
      }
    }
    description = "Block known vuln-scanner signatures"
  }

  rule {
    action   = "deny(403)"
    priority = 1005
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('protocolattack-v33-stable')"
      }
    }
    description = "Block protocol-level attacks"
  }

  rule {
    action   = "deny(403)"
    priority = 1006
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sessionfixation-v33-stable')"
      }
    }
    description = "Block session fixation"
  }

  rule {
    action   = "throttle"
    priority = 2000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
    }
    description = "Basic per-IP rate limit"
  }

  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

# Edge security policy for the frontend backend bucket (storage.tf/lb.tf).
# Edge policies attach to backend buckets instead of backend services, and
# only support a rules subset — no preconfigured WAF expressions, just
# IP-based allow/deny and rate limiting. The frontend bucket serves only
# static JS/CSS/HTML with no server-side logic, so this narrower coverage is
# an accepted trade-off, not an oversight.
resource "google_compute_security_policy" "frontend_edge" {
  provider = google-beta
  name     = "ehr-translator-frontend-edge"
  type     = "CLOUD_ARMOR_EDGE"

  rule {
    action   = "throttle"
    priority = 2000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 200
        interval_sec = 60
      }
    }
    description = "Basic per-IP rate limit"
  }

  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}
