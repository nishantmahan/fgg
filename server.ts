import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Metadata fetching
  app.get("/api/metadata", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const urlObj = new URL(url);
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        },
        timeout: 5000,
      });

      const $ = cheerio.load(response.data);
      const title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text() ||
        urlObj.hostname;

      let favicon =
        $('link[rel="apple-touch-icon"]').attr("href") ||
        $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        "/favicon.ico";

      if (favicon && !favicon.startsWith("http")) {
        favicon = new URL(favicon, urlObj.origin).href;
      }

      res.json({ title: title.trim(), favicon });
    } catch (error) {
      console.warn("Metadata fetch error for URL:", url, error instanceof Error ? error.message : error);
      try {
        const urlObj = new URL(url);
        res.json({
          title: urlObj.hostname,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
        });
      } catch (e) {
        res.status(400).json({ error: "Invalid URL provided" });
      }
    }
  });

  // Helper to fetch gas price from public RPC nodes as fallback
  async function fetchGasFromRPC(): Promise<number> {
    const rpcUrls = [
      "https://cloudflare-eth.com",
      "https://eth.llamarpc.com",
      "https://api.securerpc.com/v1"
    ];
    for (const url of rpcUrls) {
      try {
        const rpcRes = await axios.post(
          url,
          {
            jsonrpc: "2.0",
            method: "eth_gasPrice",
            params: [],
            id: 1,
          },
          { timeout: 3000 }
        );
        if (rpcRes.data && rpcRes.data.result) {
          const hexVal = rpcRes.data.result;
          const wei = parseInt(hexVal, 16);
          if (!isNaN(wei)) {
            const gwei = Math.round(wei / 1e9);
            if (gwei > 0) {
              return gwei;
            }
          }
        }
      } catch (err) {
        console.warn(`Fallback RPC ${url} failed:`, err instanceof Error ? err.message : err);
      }
    }
    throw new Error("All public RPC attempts failed");
  }

  // API Route: Gas Tracker
  app.get("/api/gas", async (req, res) => {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    
    // 1. Try Etherscan first if API Key is available
    if (apiKey) {
      try {
        const response = await axios.get(
          `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${apiKey}`,
          { timeout: 5000 }
        );
        
        if (response.data && response.data.status === "1") {
          return res.json(response.data);
        }
        
        console.warn("Etherscan API returned error status:", response.data?.result || response.data);
      } catch (error) {
        console.warn("Etherscan API fetch exception, trying fallback:", error instanceof Error ? error.message : error);
      }
    }

    // 2. Fallback to public RPC if Etherscan failed, rate limited, or wasn't configured
    try {
      const gweiPrice = await fetchGasFromRPC();
      return res.json({
        status: "1",
        message: "OK",
        result: {
          LastBlock: "",
          SafeGasPrice: String(gweiPrice),
          ProposeGasPrice: String(gweiPrice),
          FastGasPrice: String(gweiPrice),
          suggestBaseFee: String(gweiPrice),
          gasUsedRatio: "0.5"
        }
      });
    } catch (fallbackError) {
      console.error("Gas fetch completely failed:", fallbackError instanceof Error ? fallbackError.message : fallbackError);
      return res.json({ error: "Failed to fetch gas price", status: "0" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
