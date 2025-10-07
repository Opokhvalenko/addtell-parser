import type { FastifyPluginAsync } from "fastify";

type Theme = {
  name: string;
  gradient: string;
  textColor: string;
  icon: string;
  cpm: number;
};

function pickRandom<T>(arr: readonly T[]): T {
  const len = arr.length;
  if (len === 0) {
    throw new Error("No themes configured");
  }
  const idx = Math.floor(Math.random() * len);
  const value = arr[idx];
  if (value === undefined) {
    throw new Error("Random selection failed");
  }
  return value;
}

const routes: FastifyPluginAsync = async (app) => {
  app.get("/api/beautiful-ad", async (request, _reply) => {
    const { width, height, adUnitCode } = request.query as {
      width?: string;
      height?: string;
      adUnitCode?: string;
    };

    const w = parseInt(width || "300", 10);
    const h = parseInt(height || "250", 10);
    const isTop = adUnitCode === "ad-top";
    const _isSide = adUnitCode === "ad-side";

    const themes: Theme[] = [
      {
        name: "Gradient Galaxy",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        textColor: "#ffffff",
        icon: "🌌",
        cpm: 0.8,
      },
      {
        name: "Ocean Waves",
        gradient: "linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)",
        textColor: "#ffffff",
        icon: "🌊",
        cpm: 0.7,
      },
      {
        name: "Sunset Dreams",
        gradient: "linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)",
        textColor: "#ffffff",
        icon: "🌅",
        cpm: 0.9,
      },
      {
        name: "Forest Magic",
        gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)",
        textColor: "#ffffff",
        icon: "🌲",
        cpm: 0.6,
      },
      {
        name: "Purple Haze",
        gradient: "linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)",
        textColor: "#ffffff",
        icon: "💜",
        cpm: 0.75,
      },
      {
        name: "Golden Hour",
        gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)",
        textColor: "#ffffff",
        icon: "☀️",
        cpm: 0.85,
      },
    ];

    const theme = pickRandom(themes);

    const adm = `
      <div style="
        width: ${w}px;
        height: ${h}px;
        background: ${theme.gradient};
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        color: ${theme.textColor};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        position: relative;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.3s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
          pointer-events: none;
        "></div>
        <div style="font-size: ${isTop ? "48px" : "32px"}; margin-bottom: 8px;">${theme.icon}</div>
        <div style="
          font-size: ${isTop ? "18px" : "14px"};
          font-weight: 700;
          margin-bottom: 4px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${theme.name}</div>
        <div style="
          font-size: ${isTop ? "12px" : "10px"};
          opacity: 0.9;
          font-weight: 500;
        ">Beautiful Ad Experience</div>
        <div style="
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-size: 10px;
          opacity: 0.7;
          background: rgba(0,0,0,0.2);
          padding: 2px 6px;
          border-radius: 4px;
        ">${w}x${h}</div>
      </div>
    `;

    return {
      adm,
      cpm: theme.cpm,
      w,
      h,
      cur: "USD",
      ttl: 300,
      creativeId: `beautiful_${Date.now()}_${theme.name.replace(/\s+/g, "_").toLowerCase()}`,
      adomain: ["beautiful-ads.com"],
      theme: theme.name,
    };
  });
};

export default routes;
