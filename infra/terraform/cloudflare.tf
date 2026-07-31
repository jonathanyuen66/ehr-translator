# Cloudflare-side DNS + WAF for root_domain, proxying in front of Cloud
# Run's own domain-mapping feature (run.tf's google_cloud_run_domain_mapping
# resources) rather than bypassing it.
#
# An earlier version of this file tried to bypass the domain mapping
# entirely — pointing the CNAMEs straight at each service's bare *.run.app
# host and using a Cloudflare Origin Rule to override the origin-leg SNI so
# Google's *.run.app cert would still validate. That doesn't work on the
# Free plan: Cloudflare's Origin Rules "Override SNI" action is
# Enterprise-only (confirmed against Cloudflare's own docs — Free/Pro/
# Business all show "No"). So this keeps the domain mapping, which already
# provisions a Google-managed cert for the custom domain itself.
#
# Google's own docs for Cloud Run domain mappings call this combination out
# by name: "if you are using Cloudflare CDN, you must turn off the 'Always
# use https' option in the Edge Certificates tab" — a proxy that redirects
# Google's periodic cert-renewal validation request to HTTPS instead of
# passing it through can make the renewal silently fail. That's why
# always_use_https is "off" below, not "on" — this is Google's documented
# fix for exactly this pairing, not an oversight.
#
# Gated on cloudflare_zone_id/cloudflare_api_token both being set, same
# "optional until you actually set it up" pattern as every other
# manual-prerequisite integration in this repo (Mailgun, Search Console
# domain verification, etc.) — blank means none of this applies and
# root_domain keeps working exactly as it does today.
locals {
  cloudflare_enabled = var.root_domain != "" && var.cloudflare_zone_id != ""
}

# Cloud Run domain mappings for a non-apex host always resolve via this
# exact, fixed value (Google's documented target — same one dns.tf's
# Google-side app/api records already use) — proxied here instead of
# DNS-only, which is the entire point of routing through Cloudflare.
resource "cloudflare_record" "app" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "app"
  type    = "CNAME"
  content = "ghs.googlehosted.com"
  proxied = true
  ttl     = 1 # required "automatic" value whenever proxied = true
}

resource "cloudflare_record" "api" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "api"
  type    = "CNAME"
  content = "ghs.googlehosted.com"
  proxied = true
  ttl     = 1
}

# Mailgun + DMARC records — same values as dns.tf's Google-side originals,
# just re-homed here: a domain can only have one authoritative DNS provider
# at a time, so once root_domain's nameservers point at Cloudflare, Google
# Cloud DNS's zone stops being queried at all regardless of what's still
# defined there in Terraform. Never proxied (Cloudflare only proxies
# A/AAAA/CNAME records; these resolve as plain DNS on Cloudflare too).
resource "cloudflare_record" "mailgun_mx_a" {
  count    = local.cloudflare_enabled ? 1 : 0
  zone_id  = var.cloudflare_zone_id
  name     = "mg"
  type     = "MX"
  content  = "mxa.mailgun.org"
  priority = 10
  ttl      = 3600
}

resource "cloudflare_record" "mailgun_mx_b" {
  count    = local.cloudflare_enabled ? 1 : 0
  zone_id  = var.cloudflare_zone_id
  name     = "mg"
  type     = "MX"
  content  = "mxb.mailgun.org"
  priority = 10
  ttl      = 3600
}

resource "cloudflare_record" "mailgun_spf" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "mg"
  type    = "TXT"
  content = "v=spf1 include:mailgun.org ~all"
  ttl     = 3600
}

resource "cloudflare_record" "mailgun_dkim" {
  count   = local.cloudflare_enabled && var.mailgun_dkim_value != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "${var.mailgun_dkim_selector}._domainkey.mg"
  type    = "TXT"
  content = var.mailgun_dkim_value
  ttl     = 3600
}

resource "cloudflare_record" "dmarc" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=none;"
  ttl     = 3600
}

# TLS posture: "strict" validates the origin's own certificate — safe here
# specifically because the origin (via the domain mapping, not a bare
# *.run.app host) presents a Google-managed cert for the custom domain
# itself, which Cloudflare's default SNI passthrough (the visitor's own
# requested hostname) already matches with no override needed.
#
# always_use_https is deliberately "off" — see the file header. Real
# visitors are unaffected in practice (Cloud Run itself is HTTPS-only), and
# this is Google's own documented requirement for keeping cert renewal
# working under Cloudflare specifically.
resource "cloudflare_zone_settings_override" "this" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id

  settings {
    ssl              = "strict"
    always_use_https = "off"
    min_tls_version  = "1.2"
  }
}

# Free-plan bot mitigation — a basic, signal-based filter alongside the WAF
# rules below, no separate cost. enable_js is required alongside
# fight_mode (the API rejects fight_mode = true otherwise with "cannot
# enable Fight_Mode while EnableJS is disabled") — it's Cloudflare's JS
# detection signal that Fight Mode's scoring depends on.
resource "cloudflare_bot_management" "this" {
  count      = local.cloudflare_enabled ? 1 : 0
  zone_id    = var.cloudflare_zone_id
  fight_mode = true
  enable_js  = true
}

# The actual "web application firewall" roadmap item. "Cloudflare Managed
# Ruleset" and "Cloudflare OWASP Core Ruleset" (the commonly-referenced
# IDs efb7b8c9... / 4814384a...) turned out to be Pro-plan-and-up only —
# confirmed by querying this zone's actual entitled rulesets via
# `GET /zones/{zone_id}/rulesets`, which returned a different, Free-plan
# ruleset instead: "Cloudflare Managed Free Ruleset". Re-run that same query
# if this ever needs re-verifying (e.g. after a plan upgrade) rather than
# trusting a remembered/documented ID — this account's actual entitlement
# is the only thing that matters here.
resource "cloudflare_ruleset" "waf_managed" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "Managed WAF rulesets"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  rules {
    action      = "execute"
    expression  = "true"
    description = "Cloudflare Managed Free Ruleset"
    action_parameters {
      id = "77454fe2d30c4220b5701f6fdfb893ba"
    }
  }
}

# Rate limit on the two endpoints that are actually expensive to abuse: the
# uninvited-email sign-in path (already owner-notified per request
# server-side — accounts/views.py's NOTIFY_COOLDOWN — cheap for Cloudflare
# to also throttle at the edge before it ever reaches Django) and the
# free-text explain endpoint (a live Gemini + PubMed call per request).
# Free/Pro plans allow exactly one rule in this phase (confirmed by the API
# rejecting a second one with "exceeded the maximum number of rules... 2
# out of 1"), so both paths share one combined rule/threshold rather than
# each getting its own — set to the more generous of the two thresholds a
# real reader would ever hit, not the tighter one either endpoint could
# individually justify.
#
# characteristics must include cf.colo.id on the Free/Pro tiers — rate
# limiting is counted per Cloudflare colocation there, not aggregated
# globally (an Enterprise-only capability); the API rejects ["ip.src"]
# alone with an explicit error explaining this. period and mitigation_timeout
# are also plan-restricted to exactly 10 (confirmed by the API rejecting
# both a 60s period and a 300s timeout with explicit "not entitled" errors)
# — a real reader triggering this at all would just retry successfully 10s
# later, which is fine; this is aimed at sustained scripted abuse, not a
# one-time block.
resource "cloudflare_ruleset" "rate_limits" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "Rate limits — auth + explain"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action = "block"
    expression = join(" or ", [
      "(http.request.uri.path eq \"/api/auth/request-link/\" and http.request.method eq \"POST\")",
      "(http.request.uri.path contains \"/explain/\" and http.request.method eq \"POST\")",
    ])
    description = "Throttle repeated sign-in-link and ad-hoc explain requests from one IP."
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = 2
      mitigation_timeout  = 10
    }
  }
}

data "cloudflare_zone" "this" {
  count   = local.cloudflare_enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
}
