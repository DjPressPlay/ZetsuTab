// netlify/functions/search.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const query = event.queryStringParameters?.q;
  if (!query) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing query" }) };
  }

  try {
    const googleKey    = process.env.GOOGLE_API_KEY;
    const googleCx     = process.env.GOOGLE_CSE_ID;
    const newsKey      = process.env.NEWS_API_KEY;
    const searchApiKey = process.env.SEARCHAPI_KEY;

    const requests = [];

    // DUCKDUCKGO
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    requests.push(
      fetch(ddgUrl).then(r => r.json()).then(data => {
        const topics = (data.RelatedTopics || []).flatMap(i => i.Topics || [i]);
        return topics.map(i => ({
          title: i.Text || "",
          link: i.FirstURL || "",
          snippet: i.Text || "",
          source: "duckduckgo"
        }));
      }).catch(() => [])
    );

    // WIKIPEDIA
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    requests.push(
      fetch(wikiUrl).then(r => r.json()).then(data => {
        return (data.query?.search || []).map(i => ({
          title: i.title,
          link: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`,
          snippet: i.snippet,
          source: "wikipedia"
        }));
      }).catch(() => [])
    );

    // GOOGLE
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}`;
    requests.push(
      fetch(googleUrl).then(r => r.json()).then(data => {
        return (data.items || []).map(i => ({
          title: i.title,
          link: i.link,
          snippet: i.snippet,
          source: "google"
        }));
      }).catch(() => [])
    );

    // NEWS
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${newsKey}`;
    requests.push(
      fetch(newsUrl).then(r => r.json()).then(data => {
        return (data.articles || []).map(i => ({
          title: i.title,
          link: i.url,
          snippet: i.description || "",
          source: "news"
        }));
      }).catch(() => [])
    );

    // SEARCHAPI.IO
    const searchApiUrl = `https://www.searchapi.io/api/v1/search?q=${encodeURIComponent(query)}&engine=google`;
    requests.push(
      fetch(searchApiUrl, {
        headers: { Authorization: `Bearer ${searchApiKey}` }
      }).then(r => r.json()).then(data => {
        return (data.organic_results || []).map(i => ({
          title: i.title,
          link: i.link,
          snippet: i.snippet || "",
          source: "searchapi"
        }));
      }).catch(() => [])
    );

    const allResults = await Promise.all(requests);
    let items = allResults.flat();

    const seen = new Set();
    items = items.filter(i => {
      if (!i.link || seen.has(i.link)) return false;
      seen.add(i.link);
      return true;
    });

    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.source]) grouped[item.source] = [];
      if (grouped[item.source].length < 5) grouped[item.source].push(item);
    });

    const highlights = [];
    const reduced = [];
    Object.entries(grouped).forEach(([src, list]) => {
      if (list.length > 0) {
        highlights.push(list[0]);
        reduced.push(...list.slice(1));
      }
    });

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ highlights, items: reduced })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
