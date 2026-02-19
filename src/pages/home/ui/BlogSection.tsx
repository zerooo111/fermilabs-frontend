import { ArrowRight } from '@phosphor-icons/react';

const BLOG_POSTS = [
  {
    title: 'The Blockchain Capital Markets Roadmap',
    description:
      'How blockchains will achieve NASDAQ like market microstructure without trusted intermediaries.',
    image:
      'https://substackcdn.com/image/fetch/w_1200,h_600,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5539981c-cc7f-4d3c-80e2-4aafa216b8f3_1360x768.jpeg',
    url: 'https://seldonfromfermi.substack.com/p/the-blockchain-capital-markets-roadmap',
  },
  {
    title: 'The Market Structure Wars',
    description: "What's the ideal way to match orders and execute trades?",
    image:
      'https://substackcdn.com/image/fetch/w_1200,h_600,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0709ef5c-4257-44ab-a832-159968e1ec95_1200x700.png',
    url: 'https://seldonfromfermi.substack.com/p/the-market-structure-wars',
  },
];

export default function BlogSection() {
  return (
    <section className="flex flex-col py-12 md:py-20 px-4 md:px-8 border-t border-rock/20">
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-7xl mb-4 md:mb-6 leading-tight text-rock">
        From the blog
      </h2>
      <p className="text-lg sm:text-xl md:text-2xl text-rock/80 max-w-2xl mb-10 md:mb-16">
        Deep dives into market structure, protocol design, and the future of onchain trading.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {BLOG_POSTS.map(post => (
          <a
            key={post.url}
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="group border border-rock/20 bg-dark-forest/50 hover:border-rock/40 transition-all duration-200 flex flex-col overflow-hidden"
          >
            <div className="aspect-[2/1] overflow-hidden">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-5 md:p-6 flex flex-col flex-1">
              <h3 className="font-display text-xl sm:text-2xl md:text-3xl text-rock mb-2 md:mb-3 leading-tight">
                {post.title}
              </h3>
              <p className="text-rock/70 text-base sm:text-lg flex-1">{post.description}</p>
              <div className="mt-4 flex items-center gap-2 text-rock/60 group-hover:text-rock transition-colors duration-200 text-sm sm:text-base font-medium">
                Read more
                <ArrowRight
                  weight="bold"
                  size={16}
                  className="group-hover:-rotate-45 transition-transform duration-200"
                />
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
