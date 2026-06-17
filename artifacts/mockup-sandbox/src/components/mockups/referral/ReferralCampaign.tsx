export function ReferralCampaign() {
  const campaigns = [
    {
      id: "01",
      title: "50 USDC",
      sub: "Crypto Bounty",
      desc: "Refer 5+ active hunters. Verified on-chain, paid in USDC.",
    },
    {
      id: "02",
      title: "Free Access",
      sub: "Free Plan Unlock",
      desc: "Your first referral gets them a free plan. Instantly. No questions.",
    },
    {
      id: "03",
      title: "1 Year Pro",
      sub: "Yearly Challenge",
      desc: "Top referrer at end of campaign wins a full year of Pro — free.",
    },
    {
      id: "04",
      title: "Lifetime",
      sub: "Lifetime Challenge",
      desc: "Most qualified referrals in 30 days wins lifetime access. No cap.",
    },
  ];

  return (
    <div
      style={{
        width: "1280px",
        height: "720px",
        background: "#0a0a0a",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(195,255,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(195,255,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 48px 0",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "22px",
              height: "22px",
              background: "#c3ff00",
              borderRadius: "3px",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            BountyPilot AI
          </span>
        </div>
        <span
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: "13px",
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.05em",
          }}
        >
          2026
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "36px 48px 0",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Label pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid rgba(195,255,0,0.4)",
            borderRadius: "100px",
            padding: "5px 14px",
            marginBottom: "20px",
            width: "fit-content",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "11px",
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Referral Campaigns // Launchpad
          </span>
        </div>

        {/* Headline row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "32px", marginBottom: "12px" }}>
          <div>
            <div
              style={{
                fontSize: "72px",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <span style={{ color: "#fff" }}>Invite</span>{" "}
              <span style={{ color: "#c3ff00" }}>Friends.</span>
            </div>
            <div
              style={{
                fontSize: "72px",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                fontFamily: "'Space Grotesk', sans-serif",
                color: "#fff",
              }}
            >
              Win Big.
            </div>
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "15px",
            fontFamily: "'Space Mono', monospace",
            lineHeight: 1.6,
            marginBottom: "28px",
            maxWidth: "420px",
          }}
        >
          Share your referral link. The more you<br />
          bring in, the bigger the reward.
        </p>

        {/* Campaign cards — 2x2 grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: "12px",
            flex: 1,
            paddingBottom: "8px",
          }}
        >
          {campaigns.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#111111",
                border: "1px solid rgba(195,255,0,0.18)",
                borderRadius: "6px",
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Accent left bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "16px",
                  bottom: "16px",
                  width: "3px",
                  background: "#c3ff00",
                  borderRadius: "0 2px 2px 0",
                }}
              />
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span
                  style={{
                    color: "#c3ff00",
                    fontSize: "11px",
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    opacity: 0.6,
                  }}
                >
                  {c.id}
                </span>
                <span
                  style={{
                    color: "#c3ff00",
                    fontSize: "22px",
                    fontWeight: 800,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {c.title}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "11px",
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 400,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {c.sub}
                </span>
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "12px",
                  fontFamily: "'Space Mono', monospace",
                  lineHeight: 1.6,
                }}
              >
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 48px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: "11px",
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          BountyPilot AI, Inc.
        </span>
        <span
          style={{
            color: "#c3ff00",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.04em",
          }}
        >
          BountyPilot.xyz/launchpad
        </span>
      </div>
    </div>
  );
}
