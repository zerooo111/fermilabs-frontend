export default function Logo(props: { className?: string }) {
  return <img src="/logo.svg" alt="Fermilabs" className={`w-10 h-10 ${props.className}`} />;
}
