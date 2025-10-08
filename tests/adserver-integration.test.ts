import { after, before, describe, expect, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

describe("AdServer Integration Tests", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp(app);
  });

  it("should handle bid requests correctly", async () => {
    const bidRequest = {
      size: "300x250",
      type: "banner",
      geo: "US",
      uid: "test-user-123",
      floor: 0.5,
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/adserver/bid",
      payload: bidRequest,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("bids");
  });

  it("should handle beautiful ad requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/beautiful-ad",
      query: {
        size: "300x250",
        position: "left",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("should handle stats ingestion", async () => {
    const statsData = [
      {
        event: "adLoad",
        adUnitCode: "ad-top-adtelligent",
        bidder: "adtelligent",
        cpm: 2.5,
        currency: "USD",
        timestamp: Date.now(),
      },
      {
        event: "auctionInit",
        auctionId: "test-auction-123",
        adUnits: ["ad-top-adtelligent"],
        timestamp: Date.now(),
      },
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/stats/ingest",
      payload: statsData,
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it("should handle line item creation", async () => {
    // First create a user
    const userResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "testpassword123",
      },
    });

    expect(userResponse.statusCode).toBe(201);
    const userData = JSON.parse(userResponse.payload);
    const token = userData.token;

    // Create line item
    const lineItemData = {
      name: "Test Line Item",
      size: "300x250",
      type: "banner",
      minCpm: 1.0,
      maxCpm: 5.0,
      geo: ["US", "CA"],
      frequencyCap: 3,
      creativePath: "/uploads/test-creative.jpg",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/adserver/lineitems",
      payload: lineItemData,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty("id");
    expect(data.name).toBe("Test Line Item");
  });

  it("should handle frequency capping", async () => {
    const bidRequest = {
      size: "300x250",
      type: "banner",
      geo: "US",
      uid: "test-user-123",
      floor: 0.5,
    };

    // First bid request
    const response1 = await app.inject({
      method: "POST",
      url: "/api/adserver/bid",
      payload: bidRequest,
    });

    expect(response1.statusCode).toBe(200);

    // Second bid request (should be capped)
    const response2 = await app.inject({
      method: "POST",
      url: "/api/adserver/bid",
      payload: bidRequest,
    });

    expect(response2.statusCode).toBe(200);
    const data = JSON.parse(response2.payload);
    // Should have fewer bids due to frequency capping
    expect(data.bids.length).toBeLessThanOrEqual(JSON.parse(response1.payload).bids.length);
  });

  it("should handle different ad sizes", async () => {
    const sizes = ["300x250", "728x90", "320x50", "160x600"];

    for (const size of sizes) {
      const bidRequest = {
        size,
        type: "banner",
        geo: "US",
        uid: "test-user-123",
        floor: 0.5,
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/adserver/bid",
        payload: bidRequest,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty("bids");
    }
  });

  it("should handle geo targeting", async () => {
    const geoLocations = ["US", "CA", "GB", "DE"];

    for (const geo of geoLocations) {
      const bidRequest = {
        size: "300x250",
        type: "banner",
        geo,
        uid: "test-user-123",
        floor: 0.5,
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/adserver/bid",
        payload: bidRequest,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty("bids");
    }
  });

  it("should handle video ad requests", async () => {
    const bidRequest = {
      size: "640x480",
      type: "video",
      geo: "US",
      uid: "test-user-123",
      floor: 1.0,
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/adserver/bid",
      payload: bidRequest,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty("bids");
  });

  it("should handle stats export", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/stats/export",
      query: {
        format: "csv",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
  });

  it("should handle stats query", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/stats",
      query: {
        event: "adLoad",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        limit: "10",
        offset: "0",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("query");
  });
});
