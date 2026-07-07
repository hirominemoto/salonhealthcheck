exports.handler = async (event) => {
  console.log("=== analyze開始 ===");
  const { placeData } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!placeData) {
    return { statusCode: 400, body: JSON.stringify({ error: "店舗データが必要です" }) };
  }

  const systemPrompt = `美容サロン営業支援AI。営業担当が店舗オーナーへそのまま説明できる実践的な内容を出力する。ルール：①専門用語不使用、②提供データの数値を必ず根拠に使う、③同じ書き出し・表現を繰り返さない、④店舗名・地域名・数値を積極的に使い汎用文章にしない、⑤改善提案ごとに優先理由を明記する。`;

  const prompt = `以下の店舗データをもとに診断し、JSON形式のみで回答してください。前後に説明文や\`\`\`は不要です。

【店舗情報】
店舗名: ${placeData.storeName}
住所: ${placeData.address}
Google評価: ${placeData.rating ?? "不明"}
口コミ数: ${placeData.reviews ?? "不明"}件
エリア平均評価: ${placeData.areaRating ?? "不明"}
エリア平均口コミ数: ${placeData.areaReviews ?? "不明"}件
ホームページ: ${placeData.websiteUrl ?? "なし"}
営業時間の掲載: ${placeData.hasOpeningHours ? "あり" : "なし"}

{
  "summary": "店舗名と数値を含む診断要約（1〜2文）",
  "closing": "数値根拠を含む営業担当へのひとこと（1文）",
  "homepageChecks": [
    { "label": "営業時間", "passed": true, "positive": "営業時間が掲載されています", "suggestion": "営業時間を掲載してください", "outcome": "来店前に確認できます" },
    { "label": "電話番号", "passed": true, "positive": "電話番号が掲載されています", "suggestion": "電話番号を掲載してください", "outcome": "問い合わせしやすくなります" },
    { "label": "LINE導線", "passed": false, "positive": "LINE導線があります", "suggestion": "LINE相談窓口の設置をおすすめします", "outcome": "電話が苦手な世代の問い合わせハードルが下がります" },
    { "label": "FAQ", "passed": false, "positive": "FAQが設置されています", "suggestion": "よくある質問ページの設置をおすすめします", "outcome": "お客様の疑問解消につながります" },
    { "label": "GoogleMapリンク", "passed": false, "positive": "地図リンクがあります", "suggestion": "トップページへの地図リンクの設置をおすすめします", "outcome": "来店時の道案内がスムーズになります" },
    { "label": "Instagramリンク", "passed": false, "positive": "Instagramリンクがあります", "suggestion": "Instagramへのリンクをトップページへ設置することをおすすめします", "outcome": "SNSからの流入経路が確保されます" },
    { "label": "採用ページ", "passed": false, "positive": "採用情報が掲載されています", "suggestion": "採用ページへの入口の設置をおすすめします", "outcome": "応募者が情報を見つけやすくなります" },
    { "label": "ブログ更新", "passed": false, "positive": "ブログが更新されています", "suggestion": "ブログやお知らせの定期更新をおすすめします", "outcome": "サイトが活動的な印象を与えられます" },
    { "label": "予約・お問い合わせボタン", "passed": false, "positive": "予約ボタンがあります", "suggestion": "目立つ位置への予約・お問い合わせボタンの設置をおすすめします", "outcome": "お客様が次の行動に進みやすくなります" }
  ],
  "priorities": [
    { "title": "改善項目1", "workload": "低", "impact": "高", "time": "約20分", "score": 5, "issue": "数値を使った現状の問題点", "reason": "エリア比較・数値的根拠を含む優先理由", "suggestion": "具体的な改善提案", "expected_outcome": "期待できる効果" },
    { "title": "改善項目2", "workload": "低", "impact": "中", "time": "約20分", "score": 4, "issue": "現状の問題点", "reason": "優先理由", "suggestion": "具体的な改善提案", "expected_outcome": "期待できる効果" }
  ],
  "offer": {
    "title": "初回改善サポート",
    "items": ["提案項目1", "提案項目2"],
    "cta": "まず短時間でできる改善から着手しましょう"
  }
}

homepageChecksのpassedはホームページの有無と情報から推測。prioritiesは改善効果が高い順に2件。`;

  try {
    console.log("API呼び出し開始");
    const startTime = Date.now();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    console.log(`Anthropic返答 - 経過時間: ${Date.now() - startTime}ms`);

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    console.log(`JSON解析開始 - 経過時間: ${Date.now() - startTime}ms`);

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { statusCode: 500, body: JSON.stringify({ error: "JSONが見つかりませんでした", raw: text.slice(0, 300) }) };
    }

    const jsonStr = text.slice(start, end + 1);
    const analysis = JSON.parse(jsonStr);

    console.log(JSON.stringify(analysis, null, 2));
    console.log(`完了 - 合計時間: ${Date.now() - startTime}ms`);
    return { statusCode: 200, body: JSON.stringify(analysis) };
  } catch (err) {
    console.log(`エラー発生: ${err.message}`);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
