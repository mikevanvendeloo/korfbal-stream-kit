
type AppIconProps = {
  className?: string;
};

export default function AppIcon({ className = '' }: Readonly<AppIconProps>) {
  return (
    <img
      src="/logo-small.png"
      alt="Korfbal Stream Kit Logo"
      className={className}
    />
  );
}
