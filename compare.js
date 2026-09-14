exports.handler = async (event) => {
  const { reports, purpose } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!reports || reports.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: "比較データが不足しています" }) };
  }

  // ─────────────────────────────────────────
  // 比較データを構造化
  // ─────────────────────────────────────────
  const purposeLabel = purpose === "competitor"
    ? "競合店比較（同一・近接エリアの異なる店舗）"
    : "系列店比較（同じブランド・法人の店舗）";

  const storesSummary = reports.map(r => {
    const hpPassed = (r.homepageChecks || []).filter(c => c.passed).length;
    const hpTotal = (r.homepageChecks || []).length;
    const passedKeys = (r.homepageChecks || []).filter(c => c.passed).map(c => c.label);
    const failedKeys = (r.homepageChecks || []).filter(c => !c.passed).map(c => c.label);

    return {
      storeName: r.storeName,
      address: r.address,
      rating: r.map?.rating,
      areaRating: r.map?.areaRating,
      ratingVsArea: r.map?.areaRating
        ? (r.map.rating - r.map.areaRating).toFixed(1)
        : null,
      reviews: r.map?.reviews,
      areaReviews: r.map?.areaReviews,
      reviewsVsArea: r.map?.areaReviews
        ? r.map.reviews - r.map.areaReviews
        : null,
      hpScore: `${hpPassed}/${hpTotal}`,
      hpPassed: passedKeys,
      hpFailed: failedKeys,
    };
  });

  // 共通課題・個別差を事前計算
  const failedSets = storesSummary.map(s => new Set(s.hpFailed));
  const allFailedItems = [...new Set(storesSummary.flatMap(s => s.hpFailed))];
  const commonFailed = allFailedItems.filter(item =>
    failedSets.every(set => set.has(item))
  );

  const passedSets = storesSummary.map(s => new Set(s.hpPassed));
  const allPassedItems = [...new Set(storesSummary.flatMap(s => s.hpPassed))];
  const uniquelyPassed = allPassedItems.filter(item => {
    const passingStores = storesSummary.filter(s => s.hpPassed.includes(item));
    return passingStores.length === 1;
  }).map(item => ({
    item,
    store: storesSummary.find(s => s.hpPassed.includes(item))?.storeName,
  }));

  const ratings = storesSummary.map(s => s.rating).filter(Boolean);
  const ratingRange = ratings.length > 1
    ? (Math.max(...ratings) - Math.min(...ratings)).toFixed(1)
    : 0;

  const reviews = storesSummary.map(s => s.reviews).filter(Boolean);
  const reviewsRange = reviews.length > 1
    ? Math.max(...reviews) - Math.min(...reviews)
    : 0;

  // ─────────────────────────────────────────
  // AIへのプロンプト
  // ─────────────────────────────────────────
  const prompt = `あなたは美容サロンの営業支援AIです。
以下の複数店舗の診断データを見て、営業担当が顧客との商談を始めるための「気になるポイント」を発見してください。

【比較の目的】
${purposeLabel}

【店舗データ】
${JSON.stringify(storesSummary, null, 2)}

【事前集計】
- HP共通課題（全店舗で未対応）: ${commonFailed.length > 0 ? commonFailed.join("、") : "なし"}
- 1店舗だけできている項目: ${uniquelyPassed.length > 0 ? uniquelyPassed.map(u => `${u.store}のみ「${u.item}」`).join("、") : "なし"}
- Google評価の最大差: ${ratingRange}
- 口コミ数の最大差: ${reviewsRange}件

【ルール】
- 気になるポイントを3つ、簡潔に出してください
- 原因の断定や詳しい経営施策は出さないでください
- 営業担当がヒアリングの糸口にできる「問い」の形で終わると良いです
- 比較目的（系列店 or 競合）を意識した視点で書いてください
- 最後に営業への相談を促す一文を入れてください

以下のJSON形式のみで回答してください。前後に説明文や\`\`\`は不要です。JSONのみ出力してください。

{
  "purposeComment": "この店舗群の比較から見えてくることを一文で（例：同一ブランドの3店舗を比較すると、〜）",
  "points": [
    {
      "title": "気になるポイントのタイトル（10文字以内）",
      "body": "具体的な観察事実と、確認してみる価値がある問い（2〜3文）"
    },
    {
      "title": "気になるポイントのタイトル（10文字以内）",
      "body": "具体的な観察事実と、確認してみる価値がある問い（2〜3文）"
    },
    {
      "title": "気になるポイントのタイトル（10文字以内）",
      "body": "具体的な観察事実と、確認してみる価値がある問い（2〜3文）"
    }
  ],
  "closing": "詳しくは担当営業にご相談ください。（この一文で終わる形で）"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { statusCode: 500, body: JSON.stringify({ error: "JSONが見つかりませんでした", raw: text.slice(0, 300) }) };
    }

    const jsonStr = text.slice(start, end + 1);
    const insight = JSON.parse(jsonStr);

    return { statusCode: 200, body: JSON.stringify(insight) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
