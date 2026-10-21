/**
 * MarkdownDoc.tsx
 * Renders a Markdown document (GFM tables, lists, code) in the landing style.
 * Headings get slug ids so `#anchor` links and the table of contents work.
 */
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { slugify } from '../lib/parseDoc';

const IMAGE_BASE = '/points/docs/images/';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(textOf(Children.toArray(children)));
    return (
      <Tag id={id}>
        {Tag === 'h1' ? (
          children
        ) : (
          <a href={`#${id}`} className="heading-anchor">
            {children}
          </a>
        )}
      </Tag>
    );
  };
}

/** Shows the alt text in a framed box until the figure file exists. */
function Figure({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const resolved =
    src && !/^(https?:)?\//.test(src) ? IMAGE_BASE + src.replace(/^images\//, '') : src;

  if (failed || !resolved) {
    return (
      <span role="img" aria-label={alt} className="figure-missing">
        {alt}
      </span>
    );
  }
  // Charts carry small print, so a tap opens the full-size figure (mainly for phones)
  return (
    <a href={resolved} target="_blank" rel="noreferrer" className="figure-link">
      <img src={resolved} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </a>
  );
}

const components: Components = {
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  img: ({ src, alt }) => <Figure src={src} alt={alt} />,
  a: ({ href = '', children }) => {
    if (href.startsWith('/')) return <Link to={href}>{children}</Link>;
    if (href.startsWith('#')) return <a href={href}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
};

export function MarkdownDoc({ body }: { body: string }) {
  return (
    <article className="points-doc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {body}
      </ReactMarkdown>
    </article>
  );
}
