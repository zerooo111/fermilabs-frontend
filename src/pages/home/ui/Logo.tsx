export default function Logo(props: { className?: string }) {
  return <img src="/logo.svg" alt="Fermi Trade" className={`w-8 h-8 ${props.className}`} />;
}
