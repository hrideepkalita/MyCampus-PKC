import { Helmet } from "react-helmet-async";

const SITE_URL = "https://heart-of-pubkamrup.lovable.app";

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
}

const PageMeta = ({ title, description, path }: PageMetaProps) => {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default PageMeta;
