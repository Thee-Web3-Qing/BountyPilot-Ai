export function ReferralCampaign() {
  const campaigns = [
    {
      id: "01",
      prize: "$50",
      prizeLabel: "prize pool",
      title: "Refer & Win $50 Crypto",
      sub: "Top 2 Win",
      desc: "Refer the most monthly paying users. The top 2 referrers each win $25 in crypto sent directly to your wallet.",
    },
    {
      id: "02",
      prize: "2 Mo Free",
      prizeLabel: "top 10 win",
      title: "Refer & Get 2 Months Free",
      sub: "Top 10 Win",
      desc: "Refer the most free signups. Top 10 referrers with 10+ signups each win 2 months free applied to your account.",
    },
    {
      id: "03",
      prize: "$200",
      prizeLabel: "prize pool",
      title: "Yearly Challenge",
      sub: "Progressive Pool",
      desc: "Refer the most yearly subscribers. $200 prize pool unlocks progressively as the leaderboard fills up.",
    },
    {
      id: "04",
      prize: "$500",
      prizeLabel: "prize pool",
      title: "Lifetime Challenge",
      sub: "Biggest Reward",
      desc: "Refer the most lifetime members. $500 prize pool unlocks progressively. The biggest campaign on the board.",
    },
  ];

  return (
    <div
      style={{
        width: "1280px",
        height: "720px",
        background: "linear-gradient(135deg, #000000 0%, #0a1200 45%, #162600 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
            linear-gradient(rgba(195,255,0,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(195,255,0,0.10) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Green glow — bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: "-150px",
          right: "-100px",
          width: "560px",
          height: "560px",
          background: "radial-gradient(circle, rgba(195,255,0,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px 48px 0",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "22px", height: "22px", background: "#c3ff00", borderRadius: "3px", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontSize: "15px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Space Grotesk', sans-serif" }}>
            BountyPilot AI
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
          2026
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: "40px",
          padding: "28px 48px 0",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Left column — headline */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", width: "340px", flexShrink: 0, paddingTop: "4px" }}>
          {/* Label pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid rgba(195,255,0,0.45)",
              borderRadius: "100px",
              padding: "5px 14px",
              marginBottom: "20px",
              width: "fit-content",
              background: "rgba(195,255,0,0.06)",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "11px", fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Referral Campaigns
            </span>
          </div>

          <div style={{ fontSize: "64px", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", fontFamily: "'Space Grotesk', sans-serif" }}>
            <span style={{ color: "#fff" }}>Invite</span><br />
            <span style={{ color: "#c3ff00" }}>Friends.</span><br />
            <span style={{ color: "#fff" }}>Win Big.</span>
          </div>

          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", fontFamily: "'Space Mono', monospace", lineHeight: 1.65, marginTop: "18px" }}>
            Share your link. Climb<br />
            the leaderboard. Every<br />
            campaign is isolated.
          </p>

          {/* Total prize */}
          <div style={{ marginTop: "24px", padding: "14px 18px", background: "rgba(195,255,0,0.08)", border: "1px solid rgba(195,255,0,0.25)", borderRadius: "6px" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
              Total Prize Pool
            </div>
            <div style={{ color: "#c3ff00", fontSize: "32px", fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
              $750+
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingBottom: "0" }}>
            <span style={{ color: "#c3ff00", fontSize: "13px", fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em" }}>
              BountyPilot.xyz/launchpad
            </span>
          </div>
        </div>

        {/* Right column — campaign cards */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: "10px",
          }}
        >
          {campaigns.map((c) => (
            <div
              key={c.id}
              style={{
                background: "rgba(8,8,8,0.88)",
                border: "1px solid rgba(195,255,0,0.2)",
                borderRadius: "6px",
                padding: "16px 18px 16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Left accent bar */}
              <div style={{ position: "absolute", left: 0, top: "14px", bottom: "14px", width: "3px", background: "#c3ff00", borderRadius: "0 2px 2px 0" }} />

              {/* Top row: id + prize */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "rgba(195,255,0,0.5)", fontSize: "10px", fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: "0.1em" }}>
                    {c.id}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(195,255,0,0.1)", border: "1px solid rgba(195,255,0,0.25)", borderRadius: "3px", padding: "1px 6px" }}>
                    Active
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#c3ff00", fontSize: "20px", fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    {c.prize}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", fontFamily: "'Space Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {c.prizeLabel}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div style={{ color: "#ffffff", fontSize: "15px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.01em", lineHeight: 1.2 }}>
                {c.title}
              </div>

              {/* Description */}
              <p style={{ color: "#ffffff", fontSize: "12px", fontFamily: "'Space Mono', monospace", lineHeight: 1.6, opacity: 0.8 }}>
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
          padding: "14px 48px 18px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          BountyPilot AI, Inc.
        </span>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
          Join 134 hunters already competing
        </span>
      </div>
    </div>
  );
}
