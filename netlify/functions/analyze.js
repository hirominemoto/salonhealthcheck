exports.handler = async (event) => {
  const { placeData } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!placeData) {
    return { statusCode: 400, body: JSON.stringify({ error: "店舗データが必要です" }) };
  }

  const prompt = `あなたは美容サロンの営業支援AIです。以下の店舗データをもとに診断を行ってください。

【店舗情報】
店舗名: ${placeData.storeName}
住所: ${placeData.address}
Google評価: ${placeData.rating ?? "不明"}
口コミ数: ${placeData.reviews ?? "不明"}件
エリア平均評価: ${placeData.areaRating ?? "不明"}
エリア平均口コミ数: ${placeData.areaReviews ?? "不明"}件
ホームページ: ${placeData.websiteUrl ?? "なし"}
営業時間の掲載: ${placeData.hasOpeningHours ? "あり" : "なし"}

以下のJSON形式のみで回答してください。他の文章は一切不要です。

{
  "summary": "診断結果の1〜2文の要約",
  "closing": "営業担当へのひとこと（1文）",
  "homepageChecks": [
    {
      "label": "営業時間",
      "passed": true または false,
      "positive": "できている場合のコメント",
      "suggestion": "できていない場合の改善提案",
      "outcome": "改善した場合の期待効果"
    },
    {
      "label": "電話番号",
      "passed": true または false,
      "positive": "できている場合のコメント",
      "suggestion": "できていない場合の改善提案",
      "outcome": "改善した場合の期待効果"
    },
    {
      "label": "LINE導線",
      "passed": false,
      "suggestion": "LINE相談窓口の設置をおすすめします",
      "outcome": "電話が苦手な世代の問い合わせハードルが下がります"
    },
    {
      "label": "FAQ",
      "passed": false,
      "suggestion": "よくある質問ページの設置をおすすめします",
      "outcome": "お客様の疑問解消につながり、AI検索でも情報が見つけやすくなる可能性があります"
    },
    {
      "label": "GoogleMapリンク",
      "passed": false,
      "suggestion": "トップページへの地図リンクの設置をおすすめします",
      "outcome": "来店時の道案内がスムーズになります"
    },
    {
      "label": "Instagramリンク",
      "passed": false,
      "suggestion": "InstagramへのリンクをトップページへS設置することをおすすめします",
      "outcome": "SNSからの流入経路が確保されます"
    },
    {
      "label": "採用ページ",
      "passed": false,
      "suggestion": "採用ページへの入口の設置をおすすめします",
      "outcome": "応募者が情報を見つけやすくなります"
    },
    {
      "label": "ブログ更新",
      "passed": false,
      "suggestion": "ブログやお知らせの定期更新をおすすめします",
      "outcome": "サイトが活動的な印象を与えられます"
    },
    {
      "label": "予約・お問い合わせボタン",
      "passed": false,
      "suggestion": "目立つ位置への予約・お問い合わせボタンの設置をおすすめします",
      "outcome": "お客様が次の行動に進みやすくなります"
    }
  ],
  "priorities": [
    {
      "title": "改善項目のタイトル",
      "workload": "低・中・高のいずれか",
      "impact": "低・中・高のいずれか",
      "time": "約XX分",
      "score": 1〜5の数値,
      "suggestion": "具体的な改善提案",
      "outcome": "期待できる効果"
    }
  ],
  "offer": {
    "title": "初回改善サポート",
    "items": ["提案項目1", "提案項目2", "提案項目3"],
    "cta": "まず短時間でできる改善から着手しましょう"
  }
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // JSON部分だけ抽出
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { statusCode: 500, body: JSON.stringify({ error: "AI応答のパースに失敗しました" }) };
    }

    const analysis = JSON.parse(match[0]);
    return { statusCode: 200, body: JSON.stringify(analysis) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
