import Link from "next/link";
import { useRouter } from "next/router";
import { useConfig } from "nextra-theme-docs";
import type { DocsThemeConfig } from "nextra-theme-docs";

const supportEmail = "archie@ba6-bsky-suite.com";

const config: DocsThemeConfig = {
  logo: (
    <div className="ba6-logo">
      <span className="ba6-brand">BA6</span>
      <span className="ba6-title">Brodmann Area 6</span>
      <span className="ba6-pill">BA6 Docs</span>
    </div>
  ),
  project: {
    link: "https://ba6-bsky-suite.com"
  },
  chat: {
    link: "https://ba6-bsky-suite.com/support"
  },
  docsRepositoryBase: "https://github.com/ArchieCrawford/Ba6-bsky-suite",
  footer: {
    text: (
      <span>
        Contact: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </span>
    )
  },
  navigation: {
    prev: true,
    next: true
  },
  navbar: {
    extraContent: (
      <nav className="ba6-nav">
        <Link href="https://ba6-bsky-suite.com" className="ba6-nav-link">
          App
        </Link>
        <Link href="/status" className="ba6-nav-link">
          Status
        </Link>
        <Link href="/privacy" className="ba6-nav-link">
          Privacy
        </Link>
        <Link href="/support" className="ba6-nav-link">
          Support
        </Link>
      </nav>
    )
  },
  head: () => {
    const { asPath } = useRouter();
    const { frontMatter } = useConfig();
    const title = frontMatter.title ? `${frontMatter.title} · BA6 Docs` : "BA6 Docs";
    const description =
      frontMatter.description ??
      "BA6 support documentation for the Bluesky Ops Console.";
    const url = `https://support.ba6-bsky-suite.com${asPath}`;

    return (
      <>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary_large_image" />
      </>
    );
  }
};

export default config;
