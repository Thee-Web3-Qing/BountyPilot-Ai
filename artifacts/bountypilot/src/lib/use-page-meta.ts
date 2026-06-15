import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description: string;
  canonical: string;
  ogUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
}

function setMeta(property: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta(opts: PageMetaOptions) {
  useEffect(() => {
    const siteName = "BountyPilot AI";
    const ogImage = opts.ogImage ?? "https://bountypilot.xyz/opengraph.jpg";

    document.title = opts.title;

    setMeta("description", opts.description);
    setLink("canonical", opts.canonical);

    setMeta("og:site_name", siteName, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:locale", "en_US", "property");
    setMeta("og:url", opts.ogUrl ?? opts.canonical, "property");
    setMeta("og:title", opts.ogTitle ?? opts.title, "property");
    setMeta("og:description", opts.ogDescription ?? opts.description, "property");
    setMeta("og:image", ogImage, "property");
    setMeta("og:image:alt", `${siteName} — bug bounty platform`, "property");

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", opts.twitterTitle ?? opts.title);
    setMeta("twitter:description", opts.twitterDescription ?? opts.description);
    setMeta("twitter:image", ogImage);
    setMeta("twitter:image:alt", `${siteName} — bug bounty platform`);
  }, [
    opts.title,
    opts.description,
    opts.canonical,
    opts.ogUrl,
    opts.ogTitle,
    opts.ogDescription,
    opts.ogImage,
    opts.twitterTitle,
    opts.twitterDescription,
  ]);
}
