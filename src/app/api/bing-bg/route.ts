/**
 * GET /api/bing-bg
 *
 * Proxy para as fotos do dia do Bing (evita CORS no navegador).
 * Retorna as últimas 8 imagens disponíveis com URL completa e metadados.
 * Cache de 1 hora.
 */
export async function GET() {
  try {
    const url =
      "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=pt-BR";

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 }, // cache 1h no Next.js
    });

    if (!res.ok) throw new Error(`Bing responded ${res.status}`);

    const data = (await res.json()) as {
      images: Array<{
        url: string;
        urlbase: string;
        title: string;
        copyright: string;
        startdate: string;
      }>;
    };

    const images = (data.images ?? []).map((img) => ({
      full: `https://www.bing.com${img.url}`,
      thumb: `https://www.bing.com${img.urlbase}_400x240.jpg`,
      title: img.title,
      copyright: img.copyright,
      date: img.startdate, // "20260607"
    }));

    return Response.json(images, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error("[bing-bg]", err);
    return Response.json([], { status: 200 }); // graceful fallback
  }
}
